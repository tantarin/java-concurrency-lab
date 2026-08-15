package io.github.tantarin.downloader;

import java.net.URI;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicLong;

public final class Download {
    private final long id;
    private final URI source;
    private final Path target;
    private final AtomicLong downloadedBytes = new AtomicLong();
    private volatile long totalBytes = -1;
    private volatile DownloadStatus status = DownloadStatus.QUEUED;
    private volatile String error;

    Download(long id, URI source, Path target) {
        this.id = id;
        this.source = source;
        this.target = target;
    }

    public long getId() {
        return id;
    }

    public URI getSource() {
        return source;
    }

    public Path getTarget() {
        return target;
    }

    public long getDownloadedBytes() {
        return downloadedBytes.get();
    }

    public long getTotalBytes() {
        return totalBytes;
    }

    public DownloadStatus getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    void addDownloadedBytes(long count) {
        downloadedBytes.addAndGet(count);
    }

    void setTotalBytes(long totalBytes) {
        this.totalBytes = totalBytes;
    }

    void setStatus(DownloadStatus status) {
        this.status = status;
    }

    void fail(Exception exception) {
        error = exception.getMessage();
        status = DownloadStatus.FAILED;
    }
}
