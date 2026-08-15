package io.github.tantarin.downloader;

import java.net.URI;
import java.nio.file.Paths;
public final class DownloaderCli {
    private DownloaderCli() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.out.println("Usage: DownloaderCli <url> <target-file>");
            return;
        }

        try (DownloadManager manager = new DownloadManager(4, 2)) {
            Download download = manager.submit(new URI(args[0]), Paths.get(args[1]));
            while (!isFinished(download)) {
                System.out.printf("\rDownloaded: %d bytes", download.getDownloadedBytes());
                Thread.sleep(250);
            }
            System.out.printf("%nStatus: %s%n", download.getStatus());
            if (download.getError() != null) {
                System.out.println("Error: " + download.getError());
            }
        }
    }

    private static boolean isFinished(Download download) {
        DownloadStatus status = download.getStatus();
        return status == DownloadStatus.COMPLETED
            || status == DownloadStatus.CANCELLED
            || status == DownloadStatus.FAILED;
    }
}
