package io.github.tantarin.downloader;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DownloadManagerTest {
    @TempDir
    Path temporaryDirectory;

    private HttpServer server;
    private ExecutorService serverExecutor;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
        if (serverExecutor != null) {
            serverExecutor.shutdownNow();
        }
    }

    @Test
    void downloadsFileAndPublishesProgress() throws Exception {
        byte[] content = "Java concurrency in practice".getBytes(StandardCharsets.UTF_8);
        server = serverReturning(content);
        Path target = temporaryDirectory.resolve("lesson.txt");

        try (DownloadManager manager = new DownloadManager(2, 2)) {
            Download download = manager.submit(uri("/lesson"), target);

            await(() -> download.getStatus() == DownloadStatus.COMPLETED);

            assertArrayEquals(content, Files.readAllBytes(target));
            assertEquals(content.length, download.getDownloadedBytes());
            assertEquals(content.length, download.getTotalBytes());
        }
    }

    @Test
    void semaphoreLimitsSimultaneousConnections() throws Exception {
        AtomicInteger active = new AtomicInteger();
        AtomicInteger maximum = new AtomicInteger();
        CountDownLatch twoRequestsStarted = new CountDownLatch(2);
        CountDownLatch releaseResponses = new CountDownLatch(1);

        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/file", exchange -> {
            int current = active.incrementAndGet();
            maximum.accumulateAndGet(current, Math::max);
            twoRequestsStarted.countDown();
            try {
                releaseResponses.await(2, TimeUnit.SECONDS);
                byte[] body = "ok".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                active.decrementAndGet();
                exchange.close();
            }
        });
        serverExecutor = Executors.newCachedThreadPool();
        server.setExecutor(serverExecutor);
        server.start();

        try (DownloadManager manager = new DownloadManager(3, 2)) {
            Download first = manager.submit(uri("/file"), temporaryDirectory.resolve("first"));
            Download second = manager.submit(uri("/file"), temporaryDirectory.resolve("second"));
            Download third = manager.submit(uri("/file"), temporaryDirectory.resolve("third"));

            assertTrue(twoRequestsStarted.await(2, TimeUnit.SECONDS));
            assertEquals(2, maximum.get());
            releaseResponses.countDown();

            await(() -> isFinished(first) && isFinished(second) && isFinished(third));
            assertEquals(2, maximum.get());
        } finally {
            releaseResponses.countDown();
        }
    }

    private HttpServer serverReturning(byte[] content) throws IOException {
        HttpServer httpServer = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        httpServer.createContext("/lesson", exchange -> {
            exchange.sendResponseHeaders(200, content.length);
            exchange.getResponseBody().write(content);
            exchange.close();
        });
        httpServer.start();
        return httpServer;
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + server.getAddress().getPort() + path);
    }

    private static boolean isFinished(Download download) {
        DownloadStatus status = download.getStatus();
        return status == DownloadStatus.COMPLETED
            || status == DownloadStatus.CANCELLED
            || status == DownloadStatus.FAILED;
    }

    private static void await(BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) {
            Thread.sleep(10);
        }
        assertTrue(condition.getAsBoolean(), "condition was not met before timeout");
    }
}
