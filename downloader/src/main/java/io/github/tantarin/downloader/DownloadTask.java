package io.github.tantarin.downloader;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.util.concurrent.Callable;
import java.util.concurrent.Semaphore;

final class DownloadTask implements Callable<Download> {
    private static final int BUFFER_SIZE = 8192;

    private final Download download;
    private final PauseController pauseController;
    private final Semaphore connectionLimit;

    DownloadTask(Download download, PauseController pauseController, Semaphore connectionLimit) {
        this.download = download;
        this.pauseController = pauseController;
        this.connectionLimit = connectionLimit;
    }

    @Override
    public Download call() {
        try {
            connectionLimit.acquire();
            try {
                transfer();
            } finally {
                connectionLimit.release();
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            download.setStatus(DownloadStatus.CANCELLED);
        } catch (Exception exception) {
            download.fail(exception);
        }
        return download;
    }

    private void transfer() throws Exception {
        download.setStatus(DownloadStatus.DOWNLOADING);
        HttpURLConnection connection = (HttpURLConnection) download.getSource().toURL().openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(10_000);
        connection.connect();
        download.setTotalBytes(connection.getContentLengthLong());

        try (InputStream input = connection.getInputStream();
             OutputStream output = Files.newOutputStream(
                 download.getTarget(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = input.read(buffer)) != -1) {
                pauseController.awaitIfPaused();
                output.write(buffer, 0, read);
                download.addDownloadedBytes(read);
            }
            download.setStatus(DownloadStatus.COMPLETED);
        } finally {
            connection.disconnect();
        }
    }
}
