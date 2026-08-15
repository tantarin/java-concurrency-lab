const topics = [
  ['С чего начинается Java','Язык и спецификация',`
    <p>Прежде чем говорить о потоках, полезно понять, откуда вообще берутся правила Java. Java — это не только компилятор или конкретная программа на компьютере. Поведение языка описано в <strong>Java Language Specification</strong>, или JLS.</p>
    <p>Спецификация нужна, чтобы корректный код имел согласованный смысл на разных компьютерах. Приложение может работать на Linux, macOS или Windows, на разных процессорах и в разных реализациях JVM. Детали исполнения отличаются, но каждая реализация обязана соблюдать договор Java.</p>
    <pre><code>Java-код
    ↓ javac
байткод .class
    ↓ JVM и JIT
машинные инструкции
    ↓
процессор</code></pre>
    <p><code>javac</code> превращает исходный код в байткод. JVM загружает его, а JIT-компилятор во время работы может превратить часто исполняемые участки в оптимизированный машинный код.</p>
    <div class="note"><strong>Главная мысль:</strong> спецификация задаёт обязательные гарантии, а JVM, JIT и процессор находят способ их выполнить.</div>`,
    'Программы редко делают только одно дело. Дальше посмотрим, зачем им понадобилось выполнять несколько задач одновременно.'],

  ['Зачем приложениям несколько потоков','Практические примеры',`
    <p>Представь сервер объявлений. Один пользователь открывает автомобиль, второй запускает поиск, а третий добавляет объявление в избранное. Если сервер полностью заканчивает один запрос и только после этого берёт следующий, один медленный запрос задержит всех остальных.</p>
    <p>Одновременная работа нужна не только серверам. Телефон рисует интерфейс, загружает данные из сети и сохраняет их на диск. Браузер реагирует на пользователя и одновременно загружает ресурсы. Фоновый сервис получает сообщения из Kafka и обрабатывает несколько из них.</p>
    <pre><code>пользователь 1 → открыть объявление
пользователь 2 → запустить поиск
пользователь 3 → добавить в избранное</code></pre>
    <p>На многоядерном процессоре часть работы действительно может идти параллельно. В других случаях операционная система быстро переключает процессор между задачами. Потоки дают приложению отзывчивость и пропускную способность.</p>
    <div class="note">Вместе с несколькими потоками появляется главный вопрос курса: что случится, если они используют одни и те же данные?</div>`,
    'Чтобы ответить, сначала разберёмся, что такое поток и какую память потоки делят.'],

  ['Что такое поток','Process, stack и heap',`
    <p>При запуске Java-приложения операционная система создаёт процесс. Внутри него JVM может создать несколько потоков выполнения. У каждого потока есть собственный стек вызовов — контекст методов, которые он сейчас выполняет.</p>
    <p>Объекты обычно находятся в общей heap-памяти. Поэтому два потока могут получить ссылки на один объект и одновременно вызвать его методы.</p>
    <pre><code>Java-процесс

Thread 1 → свой stack ┐
Thread 2 → свой stack ├── общая heap
Thread 3 → свой stack ┘</code></pre>
    <p>Какой поток продолжит работу следующим, решает планировщик операционной системы. Он может остановить поток между двумя операциями и дать процессор другому. Поэтому нельзя полагаться на один привычный порядок переключений.</p>
    <div class="note">Опасное сочетание — несколько потоков, общее состояние и возможность его изменить.</div>`,
    'Создадим простой общий объект и посмотрим, как безопасная на вид строка ломается при одновременном вызове.'],

  ['Наш сервис просмотров','Общее изменяемое состояние',`
    <p>На протяжении курса мы будем развивать один пример — сервис, который считает открытия объявления:</p>
    <pre><code>class ViewCounter {
    private int count;

    void increment() {
        count++;
    }
}</code></pre>
    <p>Сервер хранит один экземпляр <code>ViewCounter</code>. Каждый входящий запрос обрабатывается потоком и вызывает <code>increment()</code>. Поле <code>count</code> находится в общем объекте, поэтому все потоки меняют одно значение.</p>
    <p>Если объявление одновременно открыли два человека, естественно ожидать увеличение на два. Код настолько прост, что в нём трудно заподозрить ошибку.</p>
    <div class="note">У нас есть все три условия: несколько потоков, общий объект и изменение его состояния.</div>`,
    'Разложим единственную строку count++ на действия и увидим первую гонку.'],

  ['Как теряется инкремент','Race condition и atomicity',`
    <p><code>count++</code> выглядит одной операцией в исходном коде. Но по смыслу поток должен прочитать значение, вычислить новое и записать его обратно.</p>
    <pre><code>count = 0

Thread 1: прочитал 0
Thread 2: прочитал 0
Thread 1: записал 1
Thread 2: записал 1</code></pre>
    <p>Оба запроса завершились без исключения, однако результат равен <code>1</code>. Второй поток записал значение, рассчитанное из устаревшего нуля. Один инкремент потерялся.</p>
    <p>Это <strong>race condition</strong>: результат зависит от того, как перемешались действия потоков. Требование выполнить несколько шагов как одно неделимое действие называется <strong>atomicity</strong>.</p>
    <div class="note">Ошибка может проявляться редко. Удачный запуск не доказывает, что код потокобезопасен.</div>`,
    'Нужно объявить чтение, вычисление и запись одним защищённым участком. Для этого познакомимся с mutex.'],

  ['Mutex: один ключ от комнаты','Mutual exclusion',`
    <p><strong>Mutex</strong> — сокращение от mutual exclusion, «взаимное исключение». Он не позволяет двум потокам одновременно выполнять защищённый участок кода.</p>
    <p>Представь комнату с одним ключом. Первый поток берёт ключ и входит. Второй приходит к двери, но ждёт. Когда первый выходит и возвращает ключ, войти может следующий.</p>
    <pre><code>Thread 1 → взял ключ → меняет count
Thread 2 → ключ занят → ждёт

Thread 1 → вернул ключ
Thread 2 → взял ключ → меняет count</code></pre>
    <p>Участок работы с общим ресурсом называют <strong>критической секцией</strong>. Для счётчика это всё увеличение целиком, а не только чтение или запись.</p>
    <div class="note">Mutex не выключает многопоточность программы. Он упорядочивает доступ только к конкретному ресурсу.</div>`,
    'В Java взаимное исключение можно выразить через synchronized. Посмотрим, почему ему нужен объект.'],

  ['synchronized и монитор','Первое исправление',`
    <p>С каждым Java-объектом связан механизм синхронизации — монитор. Блок <code>synchronized</code> указывает объект, монитор которого поток должен захватить:</p>
    <pre><code>class ViewCounter {
    private int count;
    private final Object lock = new Object();

    void increment() {
        synchronized (lock) {
            count++;
        }
    }
}</code></pre>
    <p>Если Thread 1 уже вошёл в блок, Thread 2 не сможет войти в блок на том же <code>lock</code>. Он ждёт освобождения монитора. После выхода монитор освобождается автоматически, даже если возникло исключение.</p>
    <p>Просто написать <code>synchronized { ... }</code> нельзя: JVM должна понимать, за какой замок конкурируют потоки.</p>
    <div class="note">Все обращения к одному защищаемому состоянию должны использовать один и тот же протокол блокировки.</div>`,
    'Почему замком служит Object, а не число? Ответ связан с идентичностью объектов.'],

  ['Почему lock — объект','Identity и разные замки',`
    <p>Объект подходит на роль замка, потому что имеет собственную идентичность. Два объекта одного типа остаются разными экземплярами и имеют разные мониторы:</p>
    <pre><code>Object lock1 = new Object();
Object lock2 = new Object();

synchronized (lock1) { /* Thread 1 */ }
synchronized (lock2) { /* Thread 2 */ }</code></pre>
    <p>Эти блоки могут выполняться одновременно. Важно не имя переменной и не тип, а то, указывают ли ссылки на один экземпляр.</p>
    <pre><code>int lock = 42;
synchronized (lock) { } // ошибка</code></pre>
    <p>Primitive — просто значение. У него нет отдельной identity и монитора, который один поток мог бы захватить, а другой обнаружить занятым.</p>
    <div class="note"><code>private final Object lock</code> подчёркивает: объект создан как приватный замок и не будет заменён.</div>`,
    'Часто отдельное поле lock не пишут. Следующая глава покажет, где тогда скрывается объект блокировки.'],

  ['Где прячется lock у метода','this и MyClass.class',`
    <p>Метод можно целиком объявить синхронизированным:</p>
    <pre><code>public synchronized void increment() {
    count++;
}</code></pre>
    <p>Объект блокировки не исчез. Для обычного метода им становится <code>this</code>. Это примерно эквивалентно <code>synchronized (this)</code>.</p>
    <p>Если создать два экземпляра <code>ViewCounter</code>, у каждого свой монитор. Два потока могут одновременно вызвать <code>a.increment()</code> и <code>b.increment()</code>, потому что захватывают разные объекты.</p>
    <p>У статического метода нет <code>this</code>. Поэтому <code>static synchronized</code> захватывает объект класса, например <code>ViewCounter.class</code>.</p>
    <div class="note">Выбор замка определяет, какие операции будут ждать друг друга, а какие смогут идти одновременно.</div>`,
    'Мы запретили одновременное изменение. Но остаётся другой вопрос: увидит ли новый результат следующий поток?'],

  ['Почему изменения нужно «увидеть»','Visibility',`
    <p>До сих пор речь шла об atomicity: действия не должны вклиниваться друг в друга. Но есть отдельная проблема — <strong>visibility</strong>, видимость изменений между потоками.</p>
    <p>JIT и процессор оптимизируют выполнение. Значение может находиться в регистре или кеше, а некоторые независимые инструкции могут быть переупорядочены. Если один поток записал значение, без специальных гарантий другой не обязан немедленно увидеть именно его.</p>
    <pre><code>Thread 1: count = 10

Thread 2: какое значение ему разрешено увидеть?</code></pre>
    <p>Полностью запретить оптимизации было бы слишком дорого. Вместо этого Java определяет действия синхронизации, через которые устанавливается необходимый порядок.</p>
    <div class="note">Atomicity отвечает «могут ли действия перемешаться?», а visibility — «обязан ли другой поток увидеть результат?»</div>`,
    'Единые правила должны работать на любых JVM и процессорах. Именно для этого существует Java Memory Model.'],

  ['Зачем придумали Java Memory Model','JMM',`
    <p>Java Memory Model — не программа, управляющая потоками, и не алгоритм конкретной JVM. Это часть спецификации: набор правил о допустимых результатах многопоточного выполнения.</p>
    <p>Разработчик по ним понимает, какие значения может наблюдать программа. Авторы JVM и JIT знают, какие оптимизации разрешены. Реализация JVM переводит эти гарантии на инструкции конкретного процессора.</p>
    <pre><code>разработчик пишет код
        ↓
JMM задаёт гарантии
        ↓
JVM и JIT оптимизируют
        ↓
CPU исполняет инструкции</code></pre>
    <p>Потоки описаны в главе 17 JLS — <em>Threads and Locks</em>. Без общих правил одна многопоточная программа могла бы иметь несовместимое поведение на разных реализациях.</p>
    <div class="note">JMM не делает любой код безопасным. Она определяет, какие гарантии создают правильные средства синхронизации.</div>`,
    'Чтобы точно связывать записи и последующие чтения, спецификация использует отношение happens-before.'],

  ['Happens-before простыми словами','JLS 17.4.5',`
    <p><strong>Happens-before</strong> — формальное отношение между действиями. Если A happens-before B, эффекты A должны быть видимы потоку, выполняющему B.</p>
    <p>Это не просто «A было раньше по часам». Действия могут физически происходить по порядку, но без нужной связи спецификация не обязана гарантировать передачу видимости.</p>
    <pre><code>Thread 1: изменил count
Thread 1: освободил monitor(lock)
                 ↓ happens-before
Thread 2: захватил тот же monitor(lock)
Thread 2: видит изменения</code></pre>
    <p>Поэтому <code>synchronized</code> решает сразу две задачи: даёт взаимное исключение и гарантии памяти. Правила happens-before описаны в разделе 17.4.5 JLS.</p>
    <div class="note">Один монитор не только не пускает потоки в критическую секцию вместе, но и передаёт видимость изменений.</div>`,
    'Один счётчик исправлен. Теперь сервис должен считать просмотры отдельно для каждого объявления — появляется Map.'],

  ['Когда одного счётчика мало','Переходим к Map',`
    <p>Сервис вырос. Теперь нужно знать число просмотров каждого объявления. Естественное решение — хранить значение по идентификатору:</p>
    <pre><code>Map&lt;String, Integer&gt; views = new HashMap&lt;&gt;();

Integer value = views.get(adId);
views.put(adId, value + 1);</code></pre>
    <p>Но экземпляр <code>HashMap</code> общий для потоков сервера. Обычный <code>HashMap</code> не обещает безопасного конкурентного изменения. Кроме того, знакомая операция увеличения снова разделена на чтение и запись.</p>
    <p>Здесь важно различить две задачи: не повредить внутреннее состояние коллекции и сделать атомарной нашу бизнес-операцию «увеличить число просмотров».</p>
    <div class="note">Потокобезопасность контейнера и потокобезопасность сценария работы с ним — не одно и то же.</div>`,
    'Сначала попробуем самое прямое решение: обернём всю Map одним знакомым замком.'],

  ['synchronizedMap: безопасная очередь','Один общий lock',`
    <p>Стандартная библиотека позволяет создать синхронизированную обёртку:</p>
    <pre><code>Map&lt;String, Integer&gt; views =
    Collections.synchronizedMap(new HashMap&lt;&gt;());</code></pre>
    <p>Методы <code>get</code>, <code>put</code> и <code>remove</code> захватывают один общий mutex. Это защищает отдельные вызовы, но создаёт очередь.</p>
    <pre><code>Thread 1: get("car:123") → держит LOCK
Thread 2: put("car:456") → ждёт LOCK</code></pre>
    <p>Потоки работают с совершенно разными объявлениями, но всё равно конкурируют за один замок. При высокой нагрузке безопасное решение становится узким местом.</p>
    <div class="note">Один общий lock прост для понимания, но заставляет независимые операции мешать друг другу.</div>`,
    'Нам нужна Map, изначально спроектированная для конкурентного доступа. Так появляется ConcurrentHashMap.'],

  ['Зачем ConcurrentHashMap','Конкурентная коллекция',`
    <p><code>ConcurrentHashMap</code> предназначена для работы нескольких потоков. Она не сводит все чтения и обновления к одному общему монитору, поэтому независимые операции обычно меньше блокируют друг друга.</p>
    <pre><code>Map&lt;String, Integer&gt; views =
    new ConcurrentHashMap&lt;&gt;();</code></pre>
    <p>Её отдельные методы имеют потокобезопасный контракт: поток не повредит внутреннюю структуру Map, пока другой выполняет разрешённую конкурентную операцию.</p>
    <p>Но слово «потокобезопасная» легко понять слишком широко. Оно относится к операциям коллекции, а не автоматически к любому алгоритму из нескольких вызовов.</p>
    <div class="note">ConcurrentHashMap не может догадаться, какие строки нашего кода должны считаться одной бизнес-операцией.</div>`,
    'Проверим старый код get → вычисление → put. Потерянный инкремент неожиданно вернётся.'],

  ['Почему get и put недостаточно','Композиция операций',`
    <p>Вернём прежний код, но теперь с <code>ConcurrentHashMap</code>:</p>
    <pre><code>Integer value = views.get("car:123");
views.put("car:123", value + 1);</code></pre>
    <p><code>get()</code> безопасен, и <code>put()</code> безопасен. Но между ними другой поток может изменить тот же ключ:</p>
    <pre><code>Thread 1: get → 0
Thread 2: get → 0
Thread 1: put → 1
Thread 2: put → 1</code></pre>
    <p>Это та же гонка, что была у поля <code>count</code>. Коллекция не знает, что два вызова и вычисление между ними образуют одно увеличение.</p>
    <div class="note">Композиция thread-safe операций не обязательно thread-safe. Границу атомарности нужно выразить явно.</div>`,
    'ConcurrentHashMap предоставляет готовые составные операции. Используем одну из них вместо пары get и put.'],

  ['Атомарные compute и merge','Правильное обновление',`
    <p><code>compute</code> позволяет описать изменение значения одного ключа как атомарную операцию:</p>
    <pre><code>views.compute(
    "car:123",
    (key, value) -> value + 1
);</code></pre>
    <p>Для счётчика часто удобнее <code>merge</code>:</p>
    <pre><code>views.merge("car:123", 1, Integer::sum);</code></pre>
    <p>Если ключа нет, <code>merge</code> запишет <code>1</code>. Если он существует, сложит старое значение и единицу. Намерение выражено целиком: «атомарно обнови этот ключ», а не «прочитай сейчас и что-нибудь запиши позже».</p>
    <div class="note">Хороший конкурентный API позволяет выразить составное действие одной операцией и закрывает опасный промежуток между чтением и записью.</div>`,
    'Теперь передадим реальные задачи ограниченному пулу потоков и разберём Executor.'],

  ['Executor: задача отдельно от потока','Пулы потоков',`
    <p>Менеджер загрузок получает много независимых задач. Создавать новый <code>Thread</code> для каждой ссылки опасно: тысяча ссылок породит тысячу потоков и может исчерпать память.</p>
    <p><code>Executor</code> разделяет два решения: задача описывает, <em>что</em> сделать, а исполнитель решает, <em>когда и каким потоком</em> её выполнить.</p>
    <pre><code>ExecutorService executor =
    Executors.newFixedThreadPool(4);

Future&lt;Download&gt; future =
    executor.submit(downloadTask);</code></pre>
    <p>В проекте четыре worker-потока забирают загрузки из внутренней очереди. Поэтому ссылок может быть много, но одновременно код выполняют не больше четырёх worker-ов.</p>
    <p><code>submit</code> возвращает <code>Future</code>. Через него менеджер может отменить конкретную загрузку вызовом <code>cancel(true)</code>. Аргумент <code>true</code> разрешает послать выполняющему потоку interruption.</p>
    <p>Пул необходимо закрыть. <code>shutdown()</code> перестаёт принимать новые задачи, но даёт принятым завершиться. Если они не завершились за отведённое время, <code>shutdownNow()</code> пытается их прервать.</p>
    <div class="note"><strong>Главная мысль:</strong> Executor управляет ограниченным ресурсом — потоками. Мы отправляем ему задачи, не создавая и не переиспользуя потоки вручную.</div>`,
    'Теперь соберём правила, по которым можно разбирать любой многопоточный код.'],

  ['Как рассуждать о многопоточном коде','Итог маршрута',`
    <p>Мы начали со спецификации не случайно. Многопоточность проходит через исходный код, JVM, оптимизации JIT, планировщик и процессор. JMM связывает эти уровни единым набором гарантий.</p>
    <p>При чтении кода полезно задавать вопросы:</p>
    <ol><li>Какие потоки здесь работают?</li><li>Какие данные между ними общие?</li><li>Могут ли данные изменяться?</li><li>Какие действия должны быть атомарными?</li><li>Что создаёт happens-before и видимость?</li><li>Не стала ли блокировка слишком широкой?</li></ol>
    <pre><code>несколько потоков
      ↓
общее изменяемое состояние
      ↓
race condition
      ↓
atomicity + visibility
      ↓
подходящий lock или concurrent API</code></pre>
    <p>Для продолжения подойдёт Brian Goetz, <em>Java Concurrency in Practice</em>. Книга разбирает публикацию объектов, locks, concurrent collections, executors, отмену задач, deadlocks и проектирование thread-safe классов.</p>
    <div class="note">Главный навык — не запоминать классы, а видеть общие данные, границы операции и передачу результатов между потоками.</div>`,
    'Маршрут завершён. К любой главе можно вернуться через список или поиск.']
].map(([title, tag, body, bridge]) => ({title, tag, body, bridge}));

const projectExamples = {
  'Зачем приложениям несколько потоков': [
    ['Открыть реальную загрузку файла', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadTask.java#L42-L63']
  ],
  'Почему изменения нужно «увидеть»': [
    ['Посмотреть volatile-состояние загрузки', 'downloader/src/main/java/io/github/tantarin/downloader/Download.java#L7-L14']
  ],
  'Зачем ConcurrentHashMap': [
    ['Посмотреть реестр загрузок и задач', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadManager.java#L15-L21']
  ],
  'Executor: задача отдельно от потока': [
    ['Создание фиксированного пула', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadManager.java#L23-L26'],
    ['Отправка Callable и получение Future', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadManager.java#L28-L37'],
    ['Отмена задачи через Future', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadManager.java#L57-L68'],
    ['Корректное завершение ExecutorService', 'downloader/src/main/java/io/github/tantarin/downloader/DownloadManager.java#L70-L80']
  ]
};

function renderProjectExamples(topic) {
  const examples = projectExamples[topic.title];
  if (!examples) return '';
  const links = examples.map(([label, path]) =>
    `<a href="https://github.com/tantarin/java-concurrency-lab/blob/main/${path}" target="_blank" rel="noreferrer">${label}<span>Открыть код ↗</span></a>`
  ).join('');
  return `<section class="project-example"><small>ЖИВОЙ ПРОЕКТ · CONCURRENT DOWNLOADER</small><h2>Где это используется</h2><div>${links}</div></section>`;
}

const app = document.querySelector('#app');
const completed = new Set(JSON.parse(localStorage.getItem('java-threads-completed-v2') || '[]'));

function save() {
  localStorage.setItem('java-threads-completed-v2', JSON.stringify([...completed]));
  updateProgress();
}

function updateProgress() {
  const count = completed.size;
  document.querySelector('#progressText').textContent = `${count} из ${topics.length}`;
  document.querySelector('#progressBar').style.width = `${count / topics.length * 100}%`;
}

function showList(search = false) {
  app.innerHTML = `<section><p class="eyebrow">Последовательный курс</p><h1>Многопоточность<br>в Java</h1><p class="intro">Один связный маршрут: от устройства Java и появления потоков до Java Memory Model и атомарных обновлений ConcurrentHashMap.</p><input class="search" type="search" placeholder="Найти тему…" aria-label="Найти тему"><div class="list"></div></section>`;
  const input = app.querySelector('.search');
  const draw = () => {
    const query = input.value.toLowerCase();
    const list = app.querySelector('.list');
    list.innerHTML = '';
    topics.forEach((topic, index) => {
      if (!(topic.title + ' ' + topic.tag).toLowerCase().includes(query)) return;
      const button = document.createElement('button');
      button.className = 'topic' + (completed.has(index) ? ' done' : '');
      button.innerHTML = `<span class="topic-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${topic.title}</strong><p>${topic.tag}</p></span><span class="check">${completed.has(index) ? '✓' : '›'}</span>`;
      button.onclick = () => showTopic(index);
      list.append(button);
    });
    if (!list.children.length) list.innerHTML = '<p class="empty">Ничего не найдено</p>';
  };
  input.oninput = draw;
  draw();
  if (search) setTimeout(() => input.focus(), 0);
  setNav(search ? 'search' : 'topics');
  window.scrollTo(0, 0);
}

function showTopic(index) {
  const topic = topics[index];
  app.innerHTML = `<article class="article"><button class="back">← Маршрут курса</button><p class="eyebrow">Глава ${index + 1} из ${topics.length} · ${topic.tag}</p><h1>${topic.title}</h1><div class="article-body">${topic.body}${renderProjectExamples(topic)}<section class="bridge"><small>ДАЛЬШЕ ПО МАРШРУТУ</small><p>${topic.bridge}</p></section></div><div class="article-actions"><button class="primary complete">${completed.has(index) ? '✓ Глава изучена' : 'Отметить изученной'}</button><button class="secondary next">${index === topics.length - 1 ? 'Вернуться к маршруту' : 'Следующая глава →'}</button></div><div class="pager"><button class="prev">${index ? '← Предыдущая глава' : ''}</button><button class="all">Все главы</button></div></article>`;
  app.querySelector('.back').onclick = showList;
  app.querySelector('.all').onclick = showList;
  app.querySelector('.complete').onclick = () => { completed.add(index); save(); showTopic(index); };
  app.querySelector('.next').onclick = () => index === topics.length - 1 ? showList() : showTopic(index + 1);
  if (index) app.querySelector('.prev').onclick = () => showTopic(index - 1);
  setNav('');
  window.scrollTo(0, 0);
}

function setNav(active) {
  document.querySelectorAll('nav button').forEach(button => button.classList.remove('active'));
  if (active === 'topics') document.querySelector('#topicsButton').classList.add('active');
  if (active === 'search') document.querySelector('#searchButton').classList.add('active');
}

document.querySelector('#homeButton').onclick = showList;
document.querySelector('#topicsButton').onclick = showList;
document.querySelector('#searchButton').onclick = () => showList(true);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
updateProgress();
showList();
