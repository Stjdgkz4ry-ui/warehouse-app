/* =========================================================
   智能仓库 - 出货统计模块 V3
   统计起点：2026-10-01 00:00 America/New_York

   V3：
   - 页面进入时不自动加载大列表
   - 选择周期后点“加载统计”
   - 默认只显示有出货 SKU
   - 0出货/滞销库存单独点开加载
   - 正常 packed/shipped 自动统计
   - 人工增加/减少必须管理员密码
   - 人工调整不修改 inventory 库存
========================================================= */
(function(){

  const START_ISO='2026-10-01T04:00:00.000Z';
  const START_DATE='2026-10-01';

  const OUTBOUND={
    period:'month',
    customStart:START_DATE,
    customEnd:'',
    search:'',
    sort:'out_desc',
    viewMode:'active', // active | zero | slow7 | slow30 | slow60 | slow90
    rows:[],
    loaded:false,
    loading:false
  };

  window.OUTBOUND=OUTBOUND;


  function n(v,d=0){
    const x=Number(v);
    return Number.isFinite(x)?x:d;
  }


  function esc(v){

    if(typeof window.escapeHtml==='function'){

      return window.escapeHtml(
        String(v??'')
      );

    }

    return String(v??'')

      .replace(
        /&/g,
        '&amp;'
      )

      .replace(
        /</g,
        '&lt;'
      )

      .replace(
        />/g,
        '&gt;'
      )

      .replace(
        /"/g,
        '&quot;'
      )

      .replace(
        /'/g,
        '&#039;'
      );

  }


  function fmt(v){

    return Math.round(
      n(v,0)
    ).toLocaleString(
      'zh-CN'
    );

  }


  function dateValue(d){

    const y=
      d.getFullYear();

    const m=
      String(
        d.getMonth()+1
      ).padStart(
        2,
        '0'
      );

    const day=
      String(
        d.getDate()
      ).padStart(
        2,
        '0'
      );

    return `${y}-${m}-${day}`;

  }


  function addDays(d,days){

    const x=
      new Date(d);

    x.setDate(
      x.getDate()+days
    );

    return x;

  }


  function startOfDay(d){

    return new Date(

      d.getFullYear(),

      d.getMonth(),

      d.getDate(),

      0,
      0,
      0,
      0

    );

  }


  function periodLabel(){

    return {

      today:'今日',

      week:'本周',

      month:'本月',

      quarter:'本季度',

      year:'本年',

      custom:'自定义'

    }[
      OUTBOUND.period
    ]||'本月';

  }


  function range(){

    const now=
      new Date();

    let start;

    let end;


    if(
      OUTBOUND.period===
      'today'
    ){

      start=
        startOfDay(
          now
        );

      end=
        addDays(
          start,
          1
        );

    }else if(
      OUTBOUND.period===
      'week'
    ){

      const t=
        startOfDay(
          now
        );

      const day=
        t.getDay();

      start=
        addDays(
          t,
          day===0
            ? -6
            : 1-day
        );

      end=
        addDays(
          start,
          7
        );

    }else if(
      OUTBOUND.period===
      'month'
    ){

      start=
        new Date(

          now.getFullYear(),

          now.getMonth(),

          1

        );

      end=
        new Date(

          now.getFullYear(),

          now.getMonth()+1,

          1

        );

    }else if(
      OUTBOUND.period===
      'quarter'
    ){

      const qm=
        Math.floor(
          now.getMonth()/3
        )*3;

      start=
        new Date(

          now.getFullYear(),

          qm,

          1

        );

      end=
        new Date(

          now.getFullYear(),

          qm+3,

          1

        );

    }else if(
      OUTBOUND.period===
      'year'
    ){

      start=
        new Date(

          now.getFullYear(),

          0,

          1

        );

      end=
        new Date(

          now.getFullYear()+1,

          0,

          1

        );

    }else{

      const s=
        OUTBOUND.customStart||
        START_DATE;

      const e=
        OUTBOUND.customEnd||
        dateValue(
          now
        );

      start=
        new Date(
          `${s}T00:00:00`
        );

      end=
        addDays(

          new Date(
            `${e}T00:00:00`
          ),

          1

        );

    }


    const hard=
      new Date(
        START_ISO
      );


    if(
      start<
      hard
    ){

      start=
        hard;

    }


    return {
      start,
      end
    };

  }


  function pageHtml(){

    return `

      <section
        id="pageOutbound"
        class="hidden">


        <div
          class="flex items-center justify-between mb-3">


          <div>


            <h1
              class="text-2xl font-bold">

              📊 出货统计

            </h1>


            <div
              class="small">

              从 2026-10-01 开始 · 正常贴单自动统计 · 人工调整需要管理员密码

            </div>


          </div>


          <button
            class="btn btn-blue btn-small"
            onclick="openManualOutboundV3()">

            ✏️ 调整出货

          </button>


        </div>


        <div
          class="card p-3 mb-3">


          <div
            class="grid grid-cols-3 gap-2">


            <button
              data-out-period="today"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('today')">

              今日

            </button>


            <button
              data-out-period="week"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('week')">

              本周

            </button>


            <button
              data-out-period="month"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('month')">

              本月

            </button>


            <button
              data-out-period="quarter"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('quarter')">

              本季度

            </button>


            <button
              data-out-period="year"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('year')">

              本年

            </button>


            <button
              data-out-period="custom"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV3('custom')">

              自定义

            </button>


          </div>


          <div
            id="outboundCustomV3"
            class="hidden mt-3">


            <div
              class="grid grid-cols-2 gap-2">


              <div>


                <label
                  class="small">

                  开始日期

                </label>


                <input
                  id="outStartV3"
                  type="date"
                  min="2026-10-01">


              </div>


              <div>


                <label
                  class="small">

                  结束日期

                </label>


                <input
                  id="outEndV3"
                  type="date"
                  min="2026-10-01">


              </div>


            </div>


          </div>


          <button
            class="btn btn-blue w-full mt-3"
            onclick="loadOutboundV3('active')">

            📊 加载 ${periodLabel()} 出货统计

          </button>


        </div>


        <div
          id="outboundSummaryV3"
          class="stat-grid mb-3">
        </div>


        <div
          id="outboundControlsV3"
          class="card p-3 mb-3 hidden">


          <input
            id="outSearchV3"
            placeholder="搜索 SKU / 商品名称"
            oninput="
              OUTBOUND.search=
                this.value
                  .trim()
                  .toLowerCase();

              renderOutboundV3();
            ">


          <div
            class="grid grid-cols-2 gap-2 mt-2">


            <select
              onchange="
                OUTBOUND.sort=
                  this.value;

                renderOutboundV3();
              ">


              <option
                value="out_desc">

                出货量：高 → 低

              </option>


              <option
                value="out_asc">

                出货量：低 → 高

              </option>


              <option
                value="stock_desc">

                库存量：高 → 低

              </option>


              <option
                value="days_desc">

                未出货天数：高 → 低

              </option>


              <option
                value="sku_asc">

                SKU：A → Z

              </option>


            </select>


            <button
              class="btn btn-green"
              onclick="exportOutboundV3()">

              📤 导出 Excel

            </button>


          </div>


          <div
            class="grid grid-cols-2 gap-2 mt-2">


            <button
              class="btn btn-gray"
              onclick="loadOutboundV3('active')">

              🔄 有出货 SKU

            </button>


            <button
              class="btn btn-yellow"
              onclick="loadOutboundV3('zero')">

              0 出货 SKU

            </button>


          </div>


          <div
            class="grid grid-cols-4 gap-2 mt-2">


            <button
              class="btn btn-gray btn-small"
              onclick="loadOutboundV3('slow7')">

              7天

            </button>


            <button
              class="btn btn-gray btn-small"
              onclick="loadOutboundV3('slow30')">

              30天

            </button>


            <button
              class="btn btn-gray btn-small"
              onclick="loadOutboundV3('slow60')">

              60天

            </button>


            <button
              class="btn btn-gray btn-small"
              onclick="loadOutboundV3('slow90')">

              90天

            </button>


          </div>


        </div>


        <div
          id="outboundListV3">


          <div
            class="card p-7 text-center text-gray-500">

            请选择时间范围，然后点“加载统计”。

          </div>


        </div>


      </section>

    `;

  }


  function inject(){


    if(
      !document.getElementById(
        'pageOutbound'
      )
    ){

      const logs=
        document.getElementById(
          'pageLogs'
        );


      if(logs){

        logs.insertAdjacentHTML(
          'beforebegin',
          pageHtml()
        );

      }

    }


    if(
      !document.getElementById(
        'navOutbound'
      )
    ){

      const nav=
        document.querySelector(
          '.bottom-nav-inner'
        );

      const logs=
        document.getElementById(
          'navLogs'
        );


      if(
        nav&&
        logs
      ){

        nav.style
          .gridTemplateColumns=
          'repeat(6,1fr)';


        logs.insertAdjacentHTML(

          'beforebegin',

          `

            <button
              id="navOutbound"
              class="nav-btn"
              onclick="showPage('outbound')">

              <span
                class="nav-icon">

                📊

              </span>

              统计

            </button>

          `

        );

      }

    }

  }


  const oldNormalize=
    window.normalizePageName;


  window.normalizePageName=
    function(page){


      if(
        page===
        'outbound'
      ){

        return 'outbound';

      }


      return typeof oldNormalize===
        'function'

        ? oldNormalize(
            page
          )

        : page;

    };


  const oldEnforce=
    window.enforceCurrentPageVisibility;


  window.enforceCurrentPageVisibility=
    function(){


      if(
        typeof oldEnforce===
        'function'
      ){

        oldEnforce();

      }


      const page=
        window.normalizePageName(

          APP.currentPage||
          'home'

        );


      const el=
        document.getElementById(
          'pageOutbound'
        );


      const nav=
        document.getElementById(
          'navOutbound'
        );


      if(el){

        el.classList.toggle(

          'hidden',

          page!==
          'outbound'

        );

      }


      if(nav){

        nav.classList.toggle(

          'active',

          page===
          'outbound'

        );

      }


      if(
        page===
        'outbound'
      ){

        [

          'Home',

          'Inventory',

          'Picking',

          'Logs',

          'Settings'

        ]
        .forEach(
          name=>{


            document
              .getElementById(
                'page'+name
              )
              ?.classList
              .add(
                'hidden'
              );


            document
              .getElementById(
                'nav'+name
              )
              ?.classList
              .remove(
                'active'
              );


          }
        );

      }

    };


  const oldShowPage=
    window.showPage;


  window.showPage=
    function(
      page,
      options={}
    ){


      if(
        page!==
        'outbound'
      ){

        return oldShowPage(
          page,
          options
        );

      }


      if(
        options.remember!==
        false &&
        typeof window.rememberCurrentPage===
        'function'
      ){

        rememberCurrentPage(
          'outbound'
        );

      }else{

        APP.currentPage=
          'outbound';

      }


      window
        .enforceCurrentPageVisibility();


      resetPage();

    };


  function updatePeriodButtons(){


    document
      .querySelectorAll(
        '[data-out-period]'
      )
      .forEach(
        btn=>{


          const active=
            btn.getAttribute(
              'data-out-period'
            )===
            OUTBOUND.period;


          btn.classList.toggle(

            'btn-blue',

            active

          );


          btn.classList.toggle(

            'btn-gray',

            !active

          );


        }
      );


    document
      .getElementById(
        'outboundCustomV3'
      )
      ?.classList
      .toggle(

        'hidden',

        OUTBOUND.period!==
        'custom'

      );

  }


  function resetPage(){


    OUTBOUND.rows=[];

    OUTBOUND.loaded=false;

    OUTBOUND.viewMode=
      'active';

    OUTBOUND.search='';


    updatePeriodButtons();


    const summary=
      document.getElementById(
        'outboundSummaryV3'
      );


    const controls=
      document.getElementById(
        'outboundControlsV3'
      );


    const list=
      document.getElementById(
        'outboundListV3'
      );


    if(summary){

      summary.innerHTML='';

    }


    controls
      ?.classList
      .add(
        'hidden'
      );


    if(list){

      list.innerHTML=`

        <div
          class="card p-7 text-center text-gray-500">

          已选择：
          ${esc(
            periodLabel()
          )}

          <br>

          点击上面的“加载
          ${esc(
            periodLabel()
          )}
          出货统计”开始查询。

        </div>

      `;

    }

  }


  window.setOutboundPeriodV3=
    function(period){


      OUTBOUND.period=
        period;


      if(
        period===
        'custom'
      ){

        const today=
          dateValue(
            new Date()
          );


        const s=
          document.getElementById(
            'outStartV3'
          );


        const e=
          document.getElementById(
            'outEndV3'
          );


        if(
          s&&
          !s.value
        ){

          s.value=
            OUTBOUND.customStart||
            START_DATE;

        }


        if(
          e&&
          !e.value
        ){

          e.value=
            OUTBOUND.customEnd||
            today;

        }

      }


      resetPage();

    };


  async function fetchStats(){


    const r=
      range();


    const tomorrow=
      addDays(
        new Date(),
        1
      );


    const [
      periodRes,
      allRes
    ]=
    await Promise.all([


      APP.sb.rpc(

        'get_outbound_stats_v1',

        {

          p_warehouse_id:
            APP.warehouse.id,

          p_start:
            r.start
              .toISOString(),

          p_end:
            r.end
              .toISOString()

        }

      ),


      APP.sb.rpc(

        'get_outbound_stats_v1',

        {

          p_warehouse_id:
            APP.warehouse.id,

          p_start:
            START_ISO,

          p_end:
            tomorrow
              .toISOString()

        }

      )


    ]);


    if(
      periodRes.error
    ){

      throw periodRes.error;

    }


    if(
      allRes.error
    ){

      throw allRes.error;

    }


    return {

      period:
        periodRes.data||
        [],

      all:
        allRes.data||
        []

    };

  }


  function inventoryMap(){


    const map=
      new Map();


    (
      APP.inventory||
      []
    )
    .forEach(
      item=>{


        if(
          item?.is_active===
          false
        ){

          return;

        }


        const sku=
          String(
            item?.sku||
            ''
          ).trim();


        if(!sku){

          return;

        }


        const key=
          sku.toLowerCase();


        if(
          !map.has(
            key
          )
        ){

          map.set(

            key,

            {

              sku,

              name:
                String(
                  item?.name||
                  sku
                ).trim()||
                sku,

              stockQty:0

            }

          );

        }


        map
          .get(
            key
          )
          .stockQty+=
          n(
            item?.qty,
            0
          );


      }
    );


    return map;

  }


  function activeRows(
    period,
    all
  ){


    const stock=
      inventoryMap();


    const allMap=
      new Map(

        all.map(
          x=>[

            String(
              x.sku||
              ''
            )
            .trim()
            .toLowerCase(),

            x

          ]
        )

      );


    return period

      .filter(
        x=>
          n(
            x.total_qty,
            0
          )>
          0
      )

      .map(
        x=>{


          const sku=
            String(
              x.sku||
              ''
            ).trim();


          const key=
            sku.toLowerCase();


          const inv=
            stock.get(
              key
            );


          const last=

            allMap
              .get(
                key
              )
              ?.last_shipped_at

            ||

            x.last_shipped_at

            ||

            null;


          const lastDate=
            last
              ? new Date(
                  last
                )
              : null;


          const daysSince=

            lastDate&&
            !Number.isNaN(
              lastDate.getTime()
            )

            ? Math.max(

                0,

                Math.floor(

                  (
                    new Date()-
                    lastDate
                  )
                  /
                  86400000

                )

              )

            : null;


          return {

            sku,

            name:
              String(
                x.name||
                inv?.name||
                sku
              ),

            stockQty:
              n(
                inv?.stockQty,
                0
              ),

            periodQty:
              n(
                x.total_qty,
                0
              ),

            shipmentCount:
              n(
                x.shipment_count,
                0
              ),

            lastShippedAt:
              last,

            daysSince

          };

        }
      );

  }


  function zeroOrSlowRows(
    period,
    all,
    mode
  ){


    const stock=
      inventoryMap();


    const periodMap=
      new Map(

        period.map(
          x=>[

            String(
              x.sku||
              ''
            )
            .trim()
            .toLowerCase(),

            x

          ]
        )

      );


    const allMap=
      new Map(

        all.map(
          x=>[

            String(
              x.sku||
              ''
            )
            .trim()
            .toLowerCase(),

            x

          ]
        )

      );


    const now=
      new Date();


    let daysThreshold=
      null;


    if(
      mode.startsWith(
        'slow'
      )
    ){

      daysThreshold=
        Number(
          mode.replace(
            'slow',
            ''
          )
        );

    }


    const rows=[];


    for(
      const base
      of stock.values()
    ){


      const key=
        base.sku
          .toLowerCase();


      const p=
        periodMap.get(
          key
        );


      const a=
        allMap.get(
          key
        );


      const periodQty=
        n(
          p?.total_qty,
          0
        );


      const last=
        a?.last_shipped_at||
        null;


      const lastDate=
        last
          ? new Date(
              last
            )
          : null;


      const daysSince=

        lastDate&&
        !Number.isNaN(
          lastDate.getTime()
        )

        ? Math.max(

            0,

            Math.floor(

              (
                now-
                lastDate
              )
              /
              86400000

            )

          )

        : null;


      let include=
        false;


      if(
        mode===
        'zero'
      ){

        include=
          periodQty===
          0;

      }else{

        include=

          daysSince===
          null

          ||

          daysSince>=
          daysThreshold;

      }


      if(
        include
      ){

        rows.push({

          sku:
            base.sku,

          name:
            base.name,

          stockQty:
            n(
              base.stockQty,
              0
            ),

          periodQty,

          shipmentCount:
            n(
              p?.shipment_count,
              0
            ),

          lastShippedAt:
            last,

          daysSince

        });

      }

    }


    return rows;

  }


  window.loadOutboundV3=
    async function(
      mode='active'
    ){


      if(
        !APP
          ?.warehouse
          ?.id
      ){

        return showError(
          '请先选择仓库'
        );

      }


      if(
        OUTBOUND.period===
        'custom'
      ){


        const s=
          document
            .getElementById(
              'outStartV3'
            )
            ?.value
          ||
          START_DATE;


        const e=
          document
            .getElementById(
              'outEndV3'
            )
            ?.value
          ||
          dateValue(
            new Date()
          );


        if(
          e<
          s
        ){

          return showError(
            '结束日期不能早于开始日期'
          );

        }


        OUTBOUND.customStart=

          s<
          START_DATE

          ? START_DATE

          : s;


        OUTBOUND.customEnd=
          e;

      }


      if(
        OUTBOUND.loading
      ){

        return;

      }


      OUTBOUND.loading=
        true;


      OUTBOUND.viewMode=
        mode;


      const list=
        document.getElementById(
          'outboundListV3'
        );


      if(list){

        list.innerHTML=`

          <div
            class="card p-6 text-center text-gray-500">

            正在读取统计...

          </div>

        `;

      }


      try{


        const data=
          await fetchStats();


        OUTBOUND.rows=

          mode===
          'active'

          ? activeRows(

              data.period,

              data.all

            )

          : zeroOrSlowRows(

              data.period,

              data.all,

              mode

            );


        OUTBOUND.loaded=
          true;


        document
          .getElementById(
            'outboundControlsV3'
          )
          ?.classList
          .remove(
            'hidden'
          );


        renderOutboundV3();


      }catch(
        error
      ){


        console.error(
          error
        );


        if(list){

          list.innerHTML=`

            <div
              class="card p-4 text-red-600">

              统计读取失败：

              ${
                esc(
                  error
                    ?.message||
                  '未知错误'
                )
              }

            </div>

          `;

        }


        showError(

          error
            ?.message
          ||
          '统计读取失败'

        );


      }finally{


        OUTBOUND.loading=
          false;


      }

    };


  function filtered(){


    let rows=[
      ...OUTBOUND.rows
    ];


    if(
      OUTBOUND.search
    ){

      rows=
        rows.filter(
          r=>

            `${r.sku} ${r.name}`

              .toLowerCase()

              .includes(
                OUTBOUND.search
              )

        );

    }


    rows.sort(
      (
        a,
        b
      )=>{


        if(
          OUTBOUND.sort===
          'out_asc'
        ){

          return (
            a.periodQty-
            b.periodQty
          );

        }


        if(
          OUTBOUND.sort===
          'stock_desc'
        ){

          return (
            b.stockQty-
            a.stockQty
          );

        }


        if(
          OUTBOUND.sort===
          'days_desc'
        ){


          const ad=

            a.daysSince===
            null

            ? 999999

            : a.daysSince;


          const bd=

            b.daysSince===
            null

            ? 999999

            : b.daysSince;


          return (
            bd-
            ad
          );

        }


        if(
          OUTBOUND.sort===
          'sku_asc'
        ){

          return a.sku
            .localeCompare(
              b.sku
            );

        }


        return (
          b.periodQty-
          a.periodQty
        );

      }
    );


    return rows;

  }


  function modeLabel(){


    if(
      OUTBOUND.viewMode===
      'active'
    ){

      return `${periodLabel()}有出货`;

    }


    if(
      OUTBOUND.viewMode===
      'zero'
    ){

      return `${periodLabel()}0出货`;

    }


    if(
      OUTBOUND.viewMode
        .startsWith(
          'slow'
        )
    ){

      return `${

        OUTBOUND.viewMode
          .replace(
            'slow',
            ''
          )

      }天未出货`;

    }


    return periodLabel();

  }


  window.renderOutboundV3=
    function(){


      const rows=
        filtered();


      const summary=
        document.getElementById(
          'outboundSummaryV3'
        );


      const list=
        document.getElementById(
          'outboundListV3'
        );


      if(
        !summary||
        !list
      ){

        return;

      }


      const totalOut=
        rows.reduce(

          (
            s,
            r
          )=>

            s+
            n(
              r.periodQty,
              0
            ),

          0

        );


      const stockTotal=
        rows.reduce(

          (
            s,
            r
          )=>

            s+
            n(
              r.stockQty,
              0
            ),

          0

        );


      summary.innerHTML=`

        <div
          class="stat">

          <div
            class="small">

            ${
              esc(
                modeLabel()
              )
            }

          </div>

          <div
            class="stat-number">

            ${
              fmt(
                rows.length
              )
            }

          </div>

        </div>


        <div
          class="stat">

          <div
            class="small">

            ${
              esc(
                periodLabel()
              )
            }出货

          </div>

          <div
            class="stat-number">

            ${
              fmt(
                totalOut
              )
            }

          </div>

        </div>


        <div
          class="stat">

          <div
            class="small">

            当前库存合计

          </div>

          <div
            class="stat-number">

            ${
              fmt(
                stockTotal
              )
            }

          </div>

        </div>


        <div
          class="stat">

          <div
            class="small">

            统计起点

          </div>

          <div
            class="text-sm font-bold mt-2">

            2026-10-01

          </div>

        </div>

      `;


      if(
        !rows.length
      ){

        list.innerHTML=`

          <div
            class="card p-8 text-center text-gray-500">

            没有符合条件的 SKU

          </div>

        `;

        return;

      }


      list.innerHTML=

        rows
          .map(
            (
              r,
              i
            )=>{


              let status=
                '正常';


              let cls=
                'badge-green';


              if(
                !r.lastShippedAt
              ){

                status=
                  '从未出货';

                cls=
                  'badge-red';

              }else if(
                r.daysSince>=
                30
              ){

                status=
                  `${r.daysSince}天未出货`;

                cls=
                  'badge-red';

              }else if(
                r.periodQty===
                0
              ){

                status=
                  `${periodLabel()}0出货`;

                cls=
                  'badge-yellow';

              }


              const last=

                r.lastShippedAt

                ? new Date(
                    r.lastShippedAt
                  )
                  .toLocaleDateString(
                    'zh-CN'
                  )

                : '从未出货';


              return `

                <div
                  class="item-row">


                  <div
                    class="flex items-start justify-between gap-3">


                    <div
                      class="min-w-0">


                      <div
                        class="font-bold break-all">

                        ${
                          i+1
                        }.

                        ${
                          esc(
                            r.sku
                          )
                        }

                      </div>


                      <div
                        class="small mt-1 break-all">

                        ${
                          esc(
                            r.name||
                            r.sku
                          )
                        }

                      </div>


                    </div>


                    <span
                      class="badge ${cls}">

                      ${
                        esc(
                          status
                        )
                      }

                    </span>


                  </div>


                  <div
                    class="grid grid-cols-2 gap-2 mt-3">


                    <div
                      class="bg-gray-50 rounded-xl p-3">


                      <div
                        class="small">

                        ${
                          esc(
                            periodLabel()
                          )
                        }出货

                      </div>


                      <div
                        class="text-xl font-bold">

                        ${
                          fmt(
                            r.periodQty
                          )
                        }

                      </div>


                    </div>


                    <div
                      class="bg-gray-50 rounded-xl p-3">


                      <div
                        class="small">

                        当前库存

                      </div>


                      <div
                        class="text-xl font-bold">

                        ${
                          fmt(
                            r.stockQty
                          )
                        }

                      </div>


                    </div>


                  </div>


                  <div
                    class="small mt-3">

                    记录次数：

                    ${
                      fmt(
                        r.shipmentCount
                      )
                    }

                    · 最后出货：

                    ${
                      esc(
                        last
                      )
                    }

                  </div>


                  <button
                    class="btn btn-gray w-full mt-3"
                    onclick='openOutboundDetailV3(${JSON.stringify(r.sku)})'>

                    查看每日明细

                  </button>


                </div>

              `;

            }
          )
          .join('');

    };


  window.openOutboundDetailV3=
    async function(
      sku
    ){


      const r=
        range();


      openModal(`

        <h2
          class="text-xl font-bold mb-2">

          SKU 出货明细

        </h2>


        <div
          class="font-semibold break-all">

          ${
            esc(
              sku
            )
          }

        </div>


        <div
          id="outDetailV3"
          class="mt-4">

          正在读取...

        </div>


        <button
          class="btn btn-gray w-full mt-4"
          onclick="closeModal()">

          关闭

        </button>

      `);


      try{


        const {
          data,
          error
        }=
        await APP.sb.rpc(

          'get_outbound_daily_v1',

          {

            p_warehouse_id:
              APP.warehouse.id,

            p_sku:
              sku,

            p_start:
              r.start
                .toISOString(),

            p_end:
              r.end
                .toISOString()

          }

        );


        if(error){

          throw error;

        }


        const el=
          document.getElementById(
            'outDetailV3'
          );


        const rows=
          data||
          [];


        if(
          !rows.length
        ){

          el.innerHTML=`

            <div
              class="bg-gray-50 rounded-xl p-4 text-center text-gray-500">

              这个时间范围内没有出货

            </div>

          `;

          return;

        }


        el.innerHTML=

          rows
            .map(
              x=>`

                <div
                  class="flex items-center justify-between border-b py-3">


                  <div>

                    ${
                      esc(
                        x.out_date
                      )
                    }

                  </div>


                  <div
                    class="text-right">


                    <div
                      class="font-bold">

                      ${
                        fmt(
                          x.total_qty
                        )
                      } 件

                    </div>


                    <div
                      class="small">

                      ${
                        fmt(
                          x.shipment_count
                        )
                      } 条记录

                    </div>


                  </div>


                </div>

              `
            )
            .join('');


      }catch(
        error
      ){


        const el=
          document.getElementById(
            'outDetailV3'
          );


        if(el){

          el.innerHTML=`

            <div
              class="text-red-600">

              ${
                esc(
                  error
                    ?.message||
                  '读取失败'
                )
              }

            </div>

          `;

        }

      }

    };


  window.openManualOutboundV3=
    function(){


      const now=
        new Date();


      const date=
        dateValue(
          now
        );


      const time=

        `${

          String(
            now.getHours()
          )
          .padStart(
            2,
            '0'
          )

        }:${

          String(
            now.getMinutes()
          )
          .padStart(
            2,
            '0'
          )

        }`;


      openModal(`

        <h2
          class="text-xl font-bold mb-2">

          ✏️ 调整出货

        </h2>


        <div
          class="bg-yellow-50 rounded-xl p-3 text-sm mb-4">

          用于漏登记或纠正统计。需要管理员密码。
          这里不会直接改变库存数量。

        </div>


        <label
          class="block text-sm font-semibold mb-2">

          操作 *

        </label>


        <select
          id="outAdjustTypeV3">


          <option
            value="add">

            ➕ 增加出货

          </option>


          <option
            value="subtract">

            ➖ 减少 / 冲销出货

          </option>


        </select>


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          SKU *

        </label>


        <input
          id="outAdjustSkuV3"
          placeholder="输入 SKU">


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          商品名称（可不填）

        </label>


        <input
          id="outAdjustNameV3"
          placeholder="商品名称">


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          数量 *

        </label>


        <input
          id="outAdjustQtyV3"
          type="number"
          min="1"
          step="1"
          placeholder="例如：5">


        <div
          class="grid grid-cols-2 gap-2 mt-3">


          <div>


            <label
              class="block text-sm font-semibold mb-2">

              日期 *

            </label>


            <input
              id="outAdjustDateV3"
              type="date"
              min="2026-10-01"
              value="${date}">


          </div>


          <div>


            <label
              class="block text-sm font-semibold mb-2">

              时间

            </label>


            <input
              id="outAdjustTimeV3"
              type="time"
              value="${time}">


          </div>


        </div>


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          原因 / 备注 *

        </label>


        <textarea
          id="outAdjustNoteV3"
          rows="3"
          placeholder="例如：昨天漏登记 / 多登记5件，现冲销">
        </textarea>


        <button
          class="btn btn-blue w-full mt-4"
          onclick="saveManualOutboundV3()">

          确认调整

        </button>


        <button
          class="btn btn-gray w-full mt-2"
          onclick="closeModal()">

          取消

        </button>


      `);

    };


  window.saveManualOutboundV3=
    async function(){


      const type=
        document
          .getElementById(
            'outAdjustTypeV3'
          )
          ?.value;


      const sku=
        document
          .getElementById(
            'outAdjustSkuV3'
          )
          ?.value
          .trim();


      const name=
        document
          .getElementById(
            'outAdjustNameV3'
          )
          ?.value
          .trim()
        ||
        null;


      const qty=
        Math.floor(

          n(

            document
              .getElementById(
                'outAdjustQtyV3'
              )
              ?.value,

            0

          )

        );


      const date=
        document
          .getElementById(
            'outAdjustDateV3'
          )
          ?.value;


      const time=
        document
          .getElementById(
            'outAdjustTimeV3'
          )
          ?.value
        ||
        '12:00';


      const note=
        document
          .getElementById(
            'outAdjustNoteV3'
          )
          ?.value
          .trim();


      if(
        !sku
      ){

        return showError(
          'SKU不能为空'
        );

      }


      if(
        qty<=0
      ){

        return showError(
          '数量必须大于0'
        );

      }


      if(
        !date
      ){

        return showError(
          '请选择日期'
        );

      }


      if(
        date<
        START_DATE
      ){

        return showError(
          '统计从2026-10-01开始'
        );

      }


      if(
        !note
      ){

        return showError(
          '必须填写调整原因'
        );

      }


      const shippedAt=
        new Date(
          `${date}T${time}:00`
        );


      if(
        Number.isNaN(
          shippedAt.getTime()
        )
      ){

        return showError(
          '时间格式错误'
        );

      }


      const pin=
        await verifyWarehouseAdminPassword(

          type===
          'subtract'

          ? `减少出货：${sku} ${qty}件`

          : `补登记出货：${sku} ${qty}件`

        );


      if(
        !pin
      ){

        return;

      }


      const delta=

        type===
        'subtract'

        ? -qty

        : qty;


      if(
        !confirm(

          `${

            type===
            'subtract'

            ? '减少/冲销'

            : '增加'

          } ${sku} ${qty} 件？

原因：${note}`

        )
      ){

        return;

      }


      try{


        showInfo(
          '正在保存出货调整...'
        );


        const {
          error
        }=
        await APP.sb.rpc(

          'adjust_manual_outbound_v2',

          {

            p_warehouse_id:
              APP.warehouse.id,

            p_sku:
              sku,

            p_delta:
              delta,

            p_shipped_at:
              shippedAt
                .toISOString(),

            p_name:
              name,

            p_note:
              note,

            p_admin_pin:
              String(
                pin
              )

          }

        );


        if(error){

          throw error;

        }


        closeModal();


        showOk(

          type===
          'subtract'

          ? `✅ 已冲销 ${qty} 件出货`

          : `✅ 已补登记 ${qty} 件出货`

        );


        if(
          OUTBOUND.loaded
        ){

          await loadOutboundV3(
            OUTBOUND.viewMode
          );

        }


      }catch(
        error
      ){


        console.error(
          error
        );


        showError(

          error
            ?.message
          ||
          '出货调整失败'

        );


      }

    };


  window.exportOutboundV3=
    function(){


      const rows=
        filtered();


      if(
        !rows.length
      ){

        return showError(
          '没有可以导出的数据'
        );

      }


      if(
        !window.XLSX
      ){

        return showError(
          'Excel组件未加载'
        );

      }


      const data=
        rows.map(

          (
            r,
            i
          )=>({

            '序号':
              i+1,

            'SKU':
              r.sku,

            '商品名称':
              r.name||
              '',

            [`${periodLabel()}出货量`]:
              Math.round(
                r.periodQty
              ),

            '当前库存':
              Math.round(
                r.stockQty
              ),

            '最后出货时间':

              r.lastShippedAt

              ? new Date(
                  r.lastShippedAt
                )
                .toLocaleString(
                  'zh-CN'
                )

              : '从未出货',

            '未出货天数':

              r.daysSince===
              null

              ? '从未出货'

              : r.daysSince

          })

        );


      const wb=
        XLSX.utils
          .book_new();


      const ws=
        XLSX.utils
          .json_to_sheet(
            data
          );


      XLSX.utils
        .book_append_sheet(

          wb,

          ws,

          '出货统计'

        );


      XLSX.writeFile(

        wb,

        `出货统计_${modeLabel()}_${dateValue(new Date())}.xlsx`

      );

    };


  function init(){


    inject();


    OUTBOUND.customEnd=
      dateValue(
        new Date()
      );


    const s=
      document.getElementById(
        'outStartV3'
      );


    const e=
      document.getElementById(
        'outEndV3'
      );


    if(s){

      s.value=
        START_DATE;

    }


    if(e){

      e.value=
        OUTBOUND.customEnd;

    }


    updatePeriodButtons();


    if(
      APP
        ?.currentPage===
      'outbound'
    ){

      window
        .enforceCurrentPageVisibility();


      resetPage();

    }

  }


  if(
    document.readyState===
    'loading'
  ){

    document.addEventListener(

      'DOMContentLoaded',

      init

    );

  }else{

    init();

  }

})();