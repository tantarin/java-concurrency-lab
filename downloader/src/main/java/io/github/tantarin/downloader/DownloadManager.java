package io.github.tantarin.downloader;

import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

public final class DownloadManager implements AutoCloseable {
    private final AtomicLong ids = new AtomicLong();
    private final ConcurrentHashMap<Long, Download> downloads = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Future<Download>> tasks = new ConcurrentHashMap<>();
    private final ExecutorService executor;
    private final Semaphore connectionLimit;
    private final PauseController pauseController = new PauseController();

    public DownloadManager(int workerCount, int maxConnections) {
        executor = Executors.newFixedThreadPool(workerCount);
        connectionLimit = new Semaphore(maxConnections);
    }

    public Download submit(URI source, Path target) {
        long id = ids.incrementAndGet();
        Download download = new Download(id, source, target);
        downloads.put(id, download);

        Future<Download> task = executor.submit(
            new DownloadTask(download, pauseController, connectionLimit));
        tasks.put(id, task);
        return download;
    }

    public Collection<Download> list() {
        return new ArrayList<>(downloads.values());
    }

    public void pauseAll() {
        pauseController.pause();
        downloads.values().stream()
            .filter(download -> download.getStatus() == DownloadStatus.DOWNLOADING)
            .forEach(download -> download.setStatus(DownloadStatus.PAUSED));
    }

    public void resumeAll() {
        downloads.values().stream()
            .filter(download -> download.getStatus() == DownloadStatus.PAUSED)
            .forEach(download -> download.setStatus(DownloadStatus.DOWNLOADING));
        pauseController.resume();
    }

    public boolean cancel(long id) {
        Future<Download> task = tasks.get(id);
        Download download = downloads.get(id);
        if (task == null || download == null) {
            return false;
        }
        boolean cancelled = task.cancel(true);
        if (cancelled) {
            download.setStatus(DownloadStatus.CANCELLED);
        }
        return cancelled;
    }

    @Override
    public void close() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException exception) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
