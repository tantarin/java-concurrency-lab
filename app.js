const topics = [
  {title:'Потерянный инкремент',tag:'Race condition',body:`<p>Есть общий счётчик:</p><pre><code>int counter = 0;

// Два потока выполняют:
counter++;</code></pre><p>Кажется, что после двух вызовов получится <code>2</code>. Но <code>counter++</code> — это не одно неделимое действие:</p><ol><li>прочитать <code>counter</code>;</li><li>прибавить <code>1</code>;</li><li>записать результат.</li></ol><pre><code>Thread 1: прочитал 0
Thread 2: прочитал 0
Thread 1: записал 1
Thread 2: записал 1</code></pre><div class="note">Итог — <code>1</code>. Один инкремент потерялся. Это пример race condition.</div>`},
  {title:'Что такое mutex',tag:'Mutual exclusion',body:`<p><strong>Mutex</strong> — механизм взаимного исключения. Он не даёт двум потокам одновременно выполнять защищённый участок кода.</p><p>Представь комнату с одним ключом. Первый поток забирает ключ и входит. Остальные ждут, пока он выйдет и вернёт ключ.</p><pre><code>Thread 1 → взял ключ → работает
Thread 2 → ждёт
Thread 3 → ждёт

Thread 1 → вернул ключ
Thread 2 → взял ключ → работает</code></pre><div class="note">В каждый момент защищённым ресурсом пользуется максимум один поток.</div>`},
  {title:'synchronized и объект lock',tag:'Monitor',body:`<p>В Java нельзя написать просто <code>synchronized { ... }</code>. Нужно указать, монитор какого объекта захватывается:</p><pre><code>private final Object lock = new Object();

synchronized (lock) {
    counter++;
}</code></pre><p>Все потоки, использующие <strong>тот же объект</strong> <code>lock</code>, входят в блок по очереди.</p><pre><code>Thread 1 → захватил monitor(lock)
Thread 2 → monitor занят → ждёт
Thread 1 → вышел → monitor свободен</code></pre>`},
  {title:'Синхронизированный метод',tag:'Неявный monitor',body:`<p>Иногда кажется, что объект блокировки не указан:</p><pre><code>public synchronized void increment() {
    counter++;
}</code></pre><p>Но для обычного метода монитором неявно является <code>this</code>:</p><pre><code>public void increment() {
    synchronized (this) {
        counter++;
    }
}</code></pre><p>Для <code>static synchronized</code> монитором будет объект класса:</p><pre><code>synchronized (MyClass.class) { ... }</code></pre>`},
  {title:'Разные lock-объекты',tag:'Identity',body:`<p>Синхронизация работает только тогда, когда потоки захватывают один и тот же объект.</p><pre><code>Object lock1 = new Object();
Object lock2 = new Object();

synchronized (lock1) { /* Thread 1 */ }
synchronized (lock2) { /* Thread 2 */ }</code></pre><p>Эти блоки могут выполняться одновременно: <code>lock1</code> и <code>lock2</code> имеют разные мониторы.</p><div class="note">Важно не имя переменной и не тип объекта, а идентичность конкретного экземпляра.</div>`},
  {title:'Почему lock — объект',tag:'Object vs primitive',body:`<p>Для отдельного замка обычно создают простой объект:</p><pre><code>private final Object lock = new Object();</code></pre><p>От него не требуется ничего, кроме собственной идентичности и монитора. Primitive для этого не подходит:</p><pre><code>int lock = 42;
synchronized (lock) { } // ошибка компиляции</code></pre><p>У значения <code>int</code> нет identity и связанного монитора. JVM должна понимать: два потока захватывают <strong>тот же объект</strong> или разные.</p>`},
  {title:'Монитор экземпляра',tag:'this',body:`<pre><code>class Counter {
    private int value;

    public synchronized void increment() {
        value++;
    }
}</code></pre><p>Здесь монитор принадлежит конкретному экземпляру <code>Counter</code>. Если создать два счётчика, они будут синхронизироваться независимо:</p><pre><code>Counter a = new Counter();
Counter b = new Counter();

a.increment(); // monitor объекта a
b.increment(); // monitor объекта b</code></pre><div class="note">Два потока могут одновременно работать с <code>a</code> и <code>b</code>, не мешая друг другу.</div>`},
  {title:'synchronizedMap',tag:'Один общий lock',body:`<pre><code>Map&lt;String, Integer&gt; map =
    Collections.synchronizedMap(new HashMap&lt;&gt;());</code></pre><p>Методы <code>get</code>, <code>put</code> и <code>remove</code> синхронизируются через один общий monitor-lock.</p><pre><code>Thread 1: get("user:1")        → держит LOCK
Thread 2: put("order:123", 42) → ждёт LOCK</code></pre><p>Даже операции с совершенно разными ключами конкурируют за одну блокировку.</p><div class="note">Это безопасно, но при большом числе потоков общий lock может стать узким местом.</div>`},
  {title:'ConcurrentHashMap: важная ловушка',tag:'Составная операция',body:`<p>Замена <code>HashMap</code> на <code>ConcurrentHashMap</code> не исправляет такую последовательность:</p><pre><code>Integer value = map.get("count");
map.put("count", value + 1);</code></pre><p><code>get()</code> и <code>put()</code> по отдельности thread-safe, но вся комбинация «прочитать → вычислить → записать» не атомарна.</p><pre><code>Thread 1: get → 0
Thread 2: get → 0
Thread 1: put → 1
Thread 2: put → 1</code></pre><div class="note">Thread-safe методы не делают автоматически атомарной их последовательность.</div>`},
  {title:'Атомарные compute и merge',tag:'ConcurrentHashMap',body:`<p>Изменение конкретного ключа можно выполнить атомарно:</p><pre><code>map.compute("count", (key, value) -> value + 1);</code></pre><p>Для счётчика также удобно использовать <code>merge</code>:</p><pre><code>map.merge("count", 1, Integer::sum);</code></pre><p>Если ключа ещё нет, будет записана единица. Если есть — текущее значение и единица будут сложены.</p><div class="note">Выбирай одну атомарную операцию вместо отдельной пары <code>get → put</code>.</div>`},
  {title:'Java Memory Model',tag:'JMM',body:`<p>Java Memory Model — не программа и не инструкция для потоков. Это набор правил, обязательных для реализаций Java.</p><pre><code>Ты пишешь Java-код
        ↓
JMM определяет гарантии
        ↓
JVM и JIT компилируют код
        ↓
CPU исполняет инструкции</code></pre><p>JVM, JIT и процессор могут оптимизировать выполнение, но наблюдаемый результат должен оставаться в пределах, разрешённых JMM.</p>`},
  {title:'Happens-before',tag:'JLS 17.4.5',body:`<p>Правила модели памяти описаны в Java Language Specification, глава 17 — <em>Threads and Locks</em>. В частности, в разделе 17.4.5 — <em>Happens-before Order</em>.</p><p>Если действие A <strong>happens-before</strong> действия B, эффекты A должны быть видимы потоку, выполняющему B.</p><div class="note">Это не обязательно означает «раньше по часам». Это формальная гарантия порядка и видимости.</div><p>Например, освобождение монитора happens-before последующего захвата того же монитора.</p>`},
  {title:'Что читать дальше',tag:'Книга',body:`<h2>Java Concurrency in Practice</h2><p>Brian Goetz и соавторы, 2006 год. Несмотря на возраст, книга остаётся фундаментальным введением в многопоточность Java.</p><p>Основные темы:</p><ul><li>потоки и <code>synchronized</code>;</li><li>visibility и atomicity;</li><li>locks и concurrent collections;</li><li>executors и thread pools;</li><li>cancellation и deadlocks;</li><li>проектирование thread-safe классов.</li></ul><div class="note">Лучше читать после знакомства с базовыми понятиями из этого короткого курса.</div>`}
];

const app=document.querySelector('#app');
const completed=new Set(JSON.parse(localStorage.getItem('java-threads-completed')||'[]'));
let current=null;
function save(){localStorage.setItem('java-threads-completed',JSON.stringify([...completed]));updateProgress()}
function updateProgress(){const n=completed.size;document.querySelector('#progressText').textContent=`${n} из ${topics.length}`;document.querySelector('#progressBar').style.width=`${n/topics.length*100}%`}
function showList(search=false){current=null;app.innerHTML=`<section><p class="eyebrow">Короткий учебник</p><h1>Многопоточность<br>в Java</h1><p class="intro">Небольшие темы о потоках, блокировках и модели памяти. Читай по порядку или используй как справочник.</p><input class="search" type="search" placeholder="Найти тему…" aria-label="Найти тему"><div class="list"></div></section>`;const input=app.querySelector('.search');const draw=()=>{const q=input.value.toLowerCase(),list=app.querySelector('.list');list.innerHTML='';topics.forEach((topic,index)=>{if(!(topic.title+' '+topic.tag).toLowerCase().includes(q))return;const button=document.createElement('button');button.className='topic'+(completed.has(index)?' done':'');button.innerHTML=`<span class="topic-number">${String(index+1).padStart(2,'0')}</span><span><strong>${topic.title}</strong><p>${topic.tag}</p></span><span class="check">${completed.has(index)?'✓':'›'}</span>`;button.onclick=()=>showTopic(index);list.append(button)});if(!list.children.length)list.innerHTML='<p class="empty">Ничего не найдено</p>'};input.oninput=draw;draw();if(search)setTimeout(()=>input.focus(),0);setNav(search?'search':'topics');window.scrollTo(0,0)}
function showTopic(index){current=index;const t=topics[index];app.innerHTML=`<article class="article"><button class="back">← Все темы</button><p class="eyebrow">Тема ${index+1} из ${topics.length} · ${t.tag}</p><h1>${t.title}</h1><div class="article-body">${t.body}</div><div class="article-actions"><button class="primary complete">${completed.has(index)?'✓ Изучено':'Отметить изученным'}</button><button class="secondary next">${index===topics.length-1?'К списку тем':'Следующая тема →'}</button></div><div class="pager"><button class="prev">${index?'← Предыдущая':''}</button><button class="all">Все темы</button></div></article>`;app.querySelector('.back').onclick=()=>showList();app.querySelector('.all').onclick=()=>showList();app.querySelector('.complete').onclick=()=>{completed.add(index);save();showTopic(index)};app.querySelector('.next').onclick=()=>index===topics.length-1?showList():showTopic(index+1);if(index)app.querySelector('.prev').onclick=()=>showTopic(index-1);setNav('');window.scrollTo(0,0)}
function setNav(active){document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));if(active==='topics')document.querySelector('#topicsButton').classList.add('active');if(active==='search')document.querySelector('#searchButton').classList.add('active')}
document.querySelector('#homeButton').onclick=()=>showList();document.querySelector('#topicsButton').onclick=()=>showList();document.querySelector('#searchButton').onclick=()=>showList(true);if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');updateProgress();showList();
