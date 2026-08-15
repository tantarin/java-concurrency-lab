package io.github.tantarin.downloader;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

final class PauseController {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition resumed = lock.newCondition();
    private boolean paused;

    void pause() {
        lock.lock();
        try {
            paused = true;
        } finally {
            lock.unlock();
        }
    }

    void resume() {
        lock.lock();
        try {
            paused = false;
            resumed.signalAll();
        } finally {
            lock.unlock();
        }
    }

    void awaitIfPaused() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (paused) {
                resumed.await();
            }
        } finally {
            lock.unlock();
        }
    }
}
