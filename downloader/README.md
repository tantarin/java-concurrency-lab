# Concurrent Downloader

Учебный, но рабочий менеджер HTTP-загрузок. Он служит сквозным примером для курса
по многопоточности: одни и те же классы постепенно развиваются по мере появления
новых тем.

## Что показывает первая версия

- `ExecutorService` ограничивает число worker-потоков;
- `Future` позволяет отменить отправленную задачу;
- `ConcurrentHashMap` хранит актуальные загрузки;
- `AtomicLong` безопасно считает байты;
- `Semaphore` ограничивает число открытых соединений;
- `ReentrantLock` и `Condition` реализуют pause/resume;
- interruption корректно завершает отменённую загрузку.

## Запуск

Нужны JDK 8+ и Maven 3:

```bash
cd downloader
mvn test
mvn package
java -cp target/concurrent-downloader-1.0-SNAPSHOT.jar \
  io.github.tantarin.downloader.DownloaderCli \
  https://example.com/file.zip ./file.zip
```

Первая версия CLI принимает одну ссылку. `DownloadManager` уже поддерживает
несколько одновременных задач, общий pause/resume и отмену по идентификатору.
