/* =========================================================
   智能仓库 - 出货统计模块 V1
   统计起点：2026-10-01 00:00 America/New_York

   功能：
   1. 今日 / 本周 / 本月 / 本季度 / 本年 / 自定义
   2. 所有库存 SKU 都显示，0 出货也显示
   3. 当前库存
   4. 最后出货时间
   5. 7 / 30 / 60 / 90 天无出货筛选
   6. 未入库商品手工补登记出货
   7. 查看 SKU 每日出货明细
   8. 导出 Excel

   注意：
   - 手工补登记不会修改库存
   - 依赖 Supabase 已运行 outbound_records_v1 SQL
========================================================= */

(function(){

  const OUTBOUND_START_ISO =
    '2026-10-01T04:00:00.000Z';

  const OUTBOUND_START_DATE =
    '2026-10-01';

  const OUTBOUND = {
    period:'month',
    customStart:OUTBOUND_START_DATE,
    customEnd:'',
    search:'',
    slowDays:'all',
    sort:'out_desc',
    rows:[],
    periodStats:[],
    allStats:[],
    loading:false
  };

  window.OUTBOUND = OUTBOUND;


  /* =========================================================
     基础工具
  ========================================================= */

  function outSafeNumber(value,fallback=0){
    const n = Number(value);
    return Number.isFinite(n)
      ? n
      : fallback;
  }

  function outEscape(value){
    if(
      typeof window.escapeHtml ===
      'function'
    ){
      return window.escapeHtml(
        String(value ?? '')
      );
    }

    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function outFormatNumber(value){
    return Math.round(
      outSafeNumber(value,0)
    ).toLocaleString('zh-CN');
  }

  function outLocalDateValue(date){
    const y =
      date.getFullYear();

    const m =
      String(
        date.getMonth()+1
      ).padStart(2,'0');

    const d =
      String(
        date.getDate()
      ).padStart(2,'0');

    return `${y}-${m}-${d}`;
  }

  function outStartOfDay(date){
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,0,0,0
    );
  }

  function outAddDays(date,days){
    const d =
      new Date(date);

    d.setDate(
      d.getDate()+days
    );

    return d;
  }


  /* =========================================================
     时间范围
  ========================================================= */

  function getOutboundPeriodRange(){

    const now =
      new Date();

    let start;
    let end;

    if(
      OUTBOUND.period ===
      'today'
    ){

      start =
        outStartOfDay(now);

      end =
        outAddDays(
          start,
          1
        );

    }else if(
      OUTBOUND.period ===
      'week'
    ){

      const today =
        outStartOfDay(now);

      const day =
        today.getDay();

      const diff =
        day===0
        ? -6
        : 1-day;

      start =
        outAddDays(
          today,
          diff
        );

      end =
        outAddDays(
          start,
          7
        );

    }else if(
      OUTBOUND.period ===
      'month'
    ){

      start =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      end =
        new Date(
          now.getFullYear(),
          now.getMonth()+1,
          1
        );

    }else if(
      OUTBOUND.period ===
      'quarter'
    ){

      const qMonth =
        Math.floor(
          now.getMonth()/3
        )*3;

      start =
        new Date(
          now.getFullYear(),
          qMonth,
          1
        );

      end =
        new Date(
          now.getFullYear(),
          qMonth+3,
          1
        );

    }else if(
      OUTBOUND.period ===
      'year'
    ){

      start =
        new Date(
          now.getFullYear(),
          0,
          1
        );

      end =
        new Date(
          now.getFullYear()+1,
          0,
          1
        );

    }else{

      const startText =
        OUTBOUND.customStart ||
        OUTBOUND_START_DATE;

      const endText =
        OUTBOUND.customEnd ||
        outLocalDateValue(now);

      start =
        new Date(
          `${startText}T00:00:00`
        );

      end =
        outAddDays(
          new Date(
            `${endText}T00:00:00`
          ),
          1
        );
    }

    const hardStart =
      new Date(
        OUTBOUND_START_ISO
      );

    if(
      start <
      hardStart
    ){
      start =
        hardStart;
    }

    return {
      start,
      end
    };
  }


  function outboundPeriodLabel(){

    const map = {
      today:'今日',
      week:'本周',
      month:'本月',
      quarter:'本季度',
      year:'本年',
      custom:'自定义'
    };

    return (
      map[
        OUTBOUND.period
      ] ||
      '本月'
    );
  }


  /* =========================================================
     页面 HTML
  ========================================================= */

  function outboundPageHtml(){

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
              从 2026-10-01 开始统计，库存中 0 出货 SKU 也会显示
            </div>
          </div>

          <button
            class="btn btn-blue btn-small"
            onclick="openManualOutboundV1()">
            ➕ 补登记
          </button>

        </div>


        <div
          class="card p-3 mb-3">

          <div
            class="grid grid-cols-3 gap-2">

            <button
              data-out-period="today"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('today')">
              今日
            </button>

            <button
              data-out-period="week"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('week')">
              本周
            </button>

            <button
              data-out-period="month"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('month')">
              本月
            </button>

            <button
              data-out-period="quarter"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('quarter')">
              本季度
            </button>

            <button
              data-out-period="year"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('year')">
              本年
            </button>

            <button
              data-out-period="custom"
              class="btn btn-gray btn-small"
              onclick="setOutboundPeriodV1('custom')">
              自定义
            </button>

          </div>


          <div
            id="outboundCustomRangeV1"
            class="hidden mt-3">

            <div
              class="grid grid-cols-2 gap-2">

              <div>
                <label class="small">
                  开始日期
                </label>

                <input
                  id="outboundStartV1"
                  type="date"
                  min="2026-10-01">
              </div>

              <div>
                <label class="small">
                  结束日期
                </label>

                <input
                  id="outboundEndV1"
                  type="date"
                  min="2026-10-01">
              </div>

            </div>

            <button
              class="btn btn-blue w-full mt-2"
              onclick="applyOutboundCustomV1()">
              查询
            </button>

          </div>

        </div>


        <div
          id="outboundSummaryV1"
          class="stat-grid mb-3">
        </div>


        <div
          class="card p-3 mb-3">

          <input
            id="outboundSearchV1"
            placeholder="搜索 SKU / 商品名称"
            oninput="
              OUTBOUND.search =
                this.value
                  .trim()
                  .toLowerCase();
              renderOutboundV1();
            ">


          <div
            class="grid grid-cols-2 gap-2 mt-2">

            <select
              id="outboundSlowV1"
              onchange="
                OUTBOUND.slowDays =
                  this.value;
                renderOutboundV1();
              ">

              <option value="all">
                全部 SKU
              </option>

              <option value="0">
                本周期 0 出货
              </option>

              <option value="7">
                7天未出货
              </option>

              <option value="30">
                30天未出货
              </option>

              <option value="60">
                60天未出货
              </option>

              <option value="90">
                90天未出货
              </option>

            </select>


            <select
              id="outboundSortV1"
              onchange="
                OUTBOUND.sort =
                  this.value;
                renderOutboundV1();
              ">

              <option value="out_desc">
                出货量：高 → 低
              </option>

              <option value="out_asc">
                出货量：低 → 高
              </option>

              <option value="stock_desc">
                库存量：高 → 低
              </option>

              <option value="days_desc">
                未出货天数：高 → 低
              </option>

              <option value="sku_asc">
                SKU：A → Z
              </option>

            </select>

          </div>


          <div
            class="grid grid-cols-2 gap-2 mt-2">

            <button
              class="btn btn-gray"
              onclick="loadOutboundStatsV1()">
              🔄 刷新
            </button>

            <button
              class="btn btn-green"
              onclick="exportOutboundExcelV1()">
              📤 导出 Excel
            </button>

          </div>

        </div>


        <div
          id="outboundListV1">
        </div>

      </section>
    `;
  }


  /* =========================================================
     注入页面和导航
  ========================================================= */

  function injectOutboundUI(){

    if(
      !document.getElementById(
        'pageOutbound'
      )
    ){

      const pageLogs =
        document.getElementById(
          'pageLogs'
        );

      if(pageLogs){

        pageLogs
          .insertAdjacentHTML(
            'beforebegin',
            outboundPageHtml()
          );
      }
    }


    if(
      !document.getElementById(
        'navOutbound'
      )
    ){

      const nav =
        document.querySelector(
          '.bottom-nav-inner'
        );

      const navLogs =
        document.getElementById(
          'navLogs'
        );

      if(
        nav &&
        navLogs
      ){

        nav.style
          .gridTemplateColumns =
          'repeat(6,1fr)';

        navLogs
          .insertAdjacentHTML(
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


  /* =========================================================
     扩展原页面导航
  ========================================================= */

  const originalNormalizePageName =
    window.normalizePageName;

  window.normalizePageName =
    function(page){

      if(
        page ===
        'outbound'
      ){
        return 'outbound';
      }

      if(
        typeof
        originalNormalizePageName ===
        'function'
      ){
        return originalNormalizePageName(
          page
        );
      }

      return page;
    };


  const originalEnforce =
    window.enforceCurrentPageVisibility;

  window.enforceCurrentPageVisibility =
    function(){

      if(
        typeof
        originalEnforce ===
        'function'
      ){
        originalEnforce();
      }

      const page =
        window.normalizePageName(
          APP.currentPage ||
          'home'
        );

      const pageOutbound =
        document.getElementById(
          'pageOutbound'
        );

      const navOutbound =
        document.getElementById(
          'navOutbound'
        );

      if(pageOutbound){

        pageOutbound
          .classList
          .toggle(
            'hidden',
            page !== 'outbound'
          );
      }

      if(navOutbound){

        navOutbound
          .classList
          .toggle(
            'active',
            page === 'outbound'
          );
      }


      if(
        page ===
        'outbound'
      ){

        [
          'Home',
          'Inventory',
          'Picking',
          'Logs',
          'Settings'
        ]
        .forEach(name=>{

          const el =
            document.getElementById(
              'page'+name
            );

          const nav =
            document.getElementById(
              'nav'+name
            );

          if(el){
            el.classList.add(
              'hidden'
            );
          }

          if(nav){
            nav.classList.remove(
              'active'
            );
          }

        });
      }
    };


  const originalShowPage =
    window.showPage;

  window.showPage =
    function(
      page,
      options={}
    ){

      if(
        page !==
        'outbound'
      ){

        return originalShowPage(
          page,
          options
        );
      }


      if(
        options.remember !==
        false
      ){

        if(
          typeof
          window.rememberCurrentPage ===
          'function'
        ){

          rememberCurrentPage(
            'outbound'
          );

        }else{

          APP.currentPage =
            'outbound';
        }

      }else{

        APP.currentPage =
          'outbound';
      }


      window
        .enforceCurrentPageVisibility();

      loadOutboundStatsV1();
    };


  /* =========================================================
     库存 SKU 汇总
  ========================================================= */

  function buildInventorySkuMap(){

    const map =
      new Map();

    (
      APP.inventory ||
      []
    )
    .forEach(item=>{

      if(
        item?.is_active ===
        false
      ){
        return;
      }

      const sku =
        String(
          item?.sku ||
          ''
        ).trim();

      if(!sku){
        return;
      }

      const key =
        sku.toLowerCase();

      if(
        !map.has(key)
      ){

        map.set(
          key,
          {
            sku,
            name:
              String(
                item?.name ||
                sku
              ).trim() ||
              sku,
            stockQty:0
          }
        );
      }

      const row =
        map.get(key);

      row.stockQty +=
        outSafeNumber(
          item?.qty,
          0
        );

    });

    return map;
  }


  /* =========================================================
     合并库存 + 出货
  ========================================================= */

  function mergeOutboundRows(
    periodStats,
    allStats
  ){

    const map =
      buildInventorySkuMap();


    const periodMap =
      new Map(
        (
          periodStats ||
          []
        ).map(x=>[
          String(
            x.sku ||
            ''
          )
          .trim()
          .toLowerCase(),
          x
        ])
      );


    const allMap =
      new Map(
        (
          allStats ||
          []
        ).map(x=>[
          String(
            x.sku ||
            ''
          )
          .trim()
          .toLowerCase(),
          x
        ])
      );


    /*
     * 手工登记但库存里不存在的 SKU
     * 也要显示
     */
    (
      allStats ||
      []
    )
    .forEach(x=>{

      const sku =
        String(
          x.sku ||
          ''
        ).trim();

      if(!sku){
        return;
      }

      const key =
        sku.toLowerCase();

      if(
        !map.has(key)
      ){

        map.set(
          key,
          {
            sku,
            name:
              String(
                x.name ||
                sku
              ).trim() ||
              sku,
            stockQty:0
          }
        );
      }

    });


    const now =
      new Date();


    return Array
      .from(
        map.values()
      )
      .map(base=>{

        const key =
          base.sku
            .toLowerCase();

        const period =
          periodMap.get(
            key
          );

        const all =
          allMap.get(
            key
          );


        const lastDate =
          all?.last_shipped_at
          ? new Date(
              all.last_shipped_at
            )
          : null;


        let daysSince =
          null;

        if(
          lastDate &&
          !Number.isNaN(
            lastDate.getTime()
          )
        ){

          daysSince =
            Math.max(
              0,
              Math.floor(
                (
                  now -
                  lastDate
                ) /
                86400000
              )
            );
        }


        return {

          sku:
            base.sku,

          name:
            base.name,

          stockQty:
            outSafeNumber(
              base.stockQty,
              0
            ),

          periodQty:
            outSafeNumber(
              period
                ?.total_qty,
              0
            ),

          shipmentCount:
            outSafeNumber(
              period
                ?.shipment_count,
              0
            ),

          lastShippedAt:
            all
              ?.last_shipped_at ||
            null,

          daysSince
        };

      });
  }


  /* =========================================================
     筛选排序
  ========================================================= */

  function getFilteredOutboundRows(){

    let rows =
      [
        ...OUTBOUND.rows
      ];


    if(
      OUTBOUND.search
    ){

      rows =
        rows.filter(row=>{

          const text =
            [
              row.sku,
              row.name
            ]
            .join(' ')
            .toLowerCase();

          return text
            .includes(
              OUTBOUND.search
            );
        });
    }


    if(
      OUTBOUND.slowDays ===
      '0'
    ){

      rows =
        rows.filter(
          row =>
            outSafeNumber(
              row.periodQty,
              0
            ) === 0
        );

    }else if(
      OUTBOUND.slowDays !==
      'all'
    ){

      const days =
        Number(
          OUTBOUND.slowDays
        );

      rows =
        rows.filter(
          row =>

            row.daysSince ===
            null ||

            row.daysSince >=
            days
        );
    }


    rows.sort(
      (a,b)=>{

        if(
          OUTBOUND.sort ===
          'out_asc'
        ){

          return (
            a.periodQty -
            b.periodQty
          );
        }


        if(
          OUTBOUND.sort ===
          'stock_desc'
        ){

          return (
            b.stockQty -
            a.stockQty
          );
        }


        if(
          OUTBOUND.sort ===
          'days_desc'
        ){

          const ad =
            a.daysSince ===
            null
            ? 999999
            : a.daysSince;

          const bd =
            b.daysSince ===
            null
            ? 999999
            : b.daysSince;

          return (
            bd -
            ad
          );
        }


        if(
          OUTBOUND.sort ===
          'sku_asc'
        ){

          return a.sku
            .localeCompare(
              b.sku
            );
        }


        return (
          b.periodQty -
          a.periodQty
        );
      }
    );


    return rows;
  }


  /* =========================================================
     切换周期
  ========================================================= */

  function refreshOutboundPeriodButtons(){

    document
      .querySelectorAll(
        '[data-out-period]'
      )
      .forEach(button=>{

        const active =
          button
            .getAttribute(
              'data-out-period'
            ) ===
          OUTBOUND.period;

        button
          .classList
          .toggle(
            'btn-blue',
            active
          );

        button
          .classList
          .toggle(
            'btn-gray',
            !active
          );
      });


    const customBox =
      document.getElementById(
        'outboundCustomRangeV1'
      );

    if(customBox){

      customBox
        .classList
        .toggle(
          'hidden',
          OUTBOUND.period !==
          'custom'
        );
    }
  }


  window.setOutboundPeriodV1 =
    function(period){

      OUTBOUND.period =
        period;

      refreshOutboundPeriodButtons();

      if(
        period !==
        'custom'
      ){

        loadOutboundStatsV1();
      }
    };


  window.applyOutboundCustomV1 =
    function(){

      OUTBOUND.customStart =
        document
          .getElementById(
            'outboundStartV1'
          )
          ?.value ||
        OUTBOUND_START_DATE;


      OUTBOUND.customEnd =
        document
          .getElementById(
            'outboundEndV1'
          )
          ?.value ||
        outLocalDateValue(
          new Date()
        );


      if(
        OUTBOUND.customStart <
        OUTBOUND_START_DATE
      ){

        OUTBOUND.customStart =
          OUTBOUND_START_DATE;
      }


      if(
        OUTBOUND.customEnd <
        OUTBOUND.customStart
      ){

        return showError(
          '结束日期不能早于开始日期'
        );
      }


      loadOutboundStatsV1();
    };


  /* =========================================================
     从 Supabase 读取统计
  ========================================================= */

  window.loadOutboundStatsV1 =
    async function(){

      if(
        !APP
          ?.warehouse
          ?.id
      ){
        return;
      }


      if(
        OUTBOUND.loading
      ){
        return;
      }


      OUTBOUND.loading =
        true;


      const list =
        document
          .getElementById(
            'outboundListV1'
          );


      if(list){

        list.innerHTML = `
          <div
            class="card p-6 text-center text-gray-500">
            正在读取出货统计...
          </div>
        `;
      }


      try{

        const range =
          getOutboundPeriodRange();


        const tomorrow =
          outAddDays(
            new Date(),
            1
          );


        const [
          periodResult,
          allResult
        ] =
        await Promise.all([

          APP.sb.rpc(
            'get_outbound_stats_v1',
            {
              p_warehouse_id:
                APP.warehouse.id,

              p_start:
                range.start
                  .toISOString(),

              p_end:
                range.end
                  .toISOString()
            }
          ),

          APP.sb.rpc(
            'get_outbound_stats_v1',
            {
              p_warehouse_id:
                APP.warehouse.id,

              p_start:
                OUTBOUND_START_ISO,

              p_end:
                tomorrow
                  .toISOString()
            }
          )

        ]);


        if(
          periodResult.error
        ){
          throw periodResult.error;
        }


        if(
          allResult.error
        ){
          throw allResult.error;
        }


        OUTBOUND.periodStats =
          periodResult.data ||
          [];


        OUTBOUND.allStats =
          allResult.data ||
          [];


        OUTBOUND.rows =
          mergeOutboundRows(
            OUTBOUND.periodStats,
            OUTBOUND.allStats
          );


        renderOutboundV1();


      }catch(error){

        console.error(
          '出货统计读取失败',
          error
        );


        if(list){

          list.innerHTML = `
            <div
              class="card p-4 text-red-600">

              统计读取失败：
              ${
                outEscape(
                  error
                    ?.message ||
                  '未知错误'
                )
              }

            </div>
          `;
        }


        showError(
          error
            ?.message ||
          '统计读取失败'
        );


      }finally{

        OUTBOUND.loading =
          false;
      }
    };


  /* =========================================================
     渲染统计列表
  ========================================================= */

  window.renderOutboundV1 =
    function(){

      const rows =
        getFilteredOutboundRows();


      const summary =
        document
          .getElementById(
            'outboundSummaryV1'
          );


      const list =
        document
          .getElementById(
            'outboundListV1'
          );


      if(
        !summary ||
        !list
      ){
        return;
      }


      const totalOut =
        rows.reduce(
          (sum,row)=>
            sum +
            outSafeNumber(
              row.periodQty,
              0
            ),
          0
        );


      const activeSku =
        rows.filter(
          row =>
            row.periodQty >
            0
        ).length;


      const zeroSku =
        rows.filter(
          row =>
            row.periodQty <=
            0
        ).length;


      const currentStock =
        rows.reduce(
          (sum,row)=>
            sum +
            outSafeNumber(
              row.stockQty,
              0
            ),
          0
        );


      summary.innerHTML = `

        <div class="stat">

          <div class="small">
            ${
              outEscape(
                outboundPeriodLabel()
              )
            }出货
          </div>

          <div
            class="stat-number">
            ${
              outFormatNumber(
                totalOut
              )
            }
          </div>

        </div>


        <div class="stat">

          <div class="small">
            有出货 SKU
          </div>

          <div
            class="stat-number">
            ${
              outFormatNumber(
                activeSku
              )
            }
          </div>

        </div>


        <div class="stat">

          <div class="small">
            0 出货 SKU
          </div>

          <div
            class="stat-number">
            ${
              outFormatNumber(
                zeroSku
              )
            }
          </div>

        </div>


        <div class="stat">

          <div class="small">
            当前库存
          </div>

          <div
            class="stat-number">
            ${
              outFormatNumber(
                currentStock
              )
            }
          </div>

        </div>
      `;


      refreshOutboundPeriodButtons();


      if(
        !rows.length
      ){

        list.innerHTML = `

          <div
            class="card p-8 text-center text-gray-500">

            没有符合条件的 SKU

          </div>
        `;

        return;
      }


      list.innerHTML =
        rows
          .map(
            (
              row,
              index
            )=>{


              const zeroOut =
                row.periodQty <=
                0;


              const neverOut =
                !row.lastShippedAt;


              let status =
                '正常';


              let statusClass =
                'badge-green';


              if(
                neverOut
              ){

                status =
                  '从未出货';

                statusClass =
                  'badge-red';

              }else if(
                row.daysSince >=
                30
              ){

                status =
                  `${row.daysSince}天未出货`;

                statusClass =
                  'badge-red';

              }else if(
                zeroOut
              ){

                status =
                  `${outboundPeriodLabel()}0出货`;

                statusClass =
                  'badge-yellow';
              }


              const lastText =
                row.lastShippedAt

                ? new Date(
                    row.lastShippedAt
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
                          index+1
                        }.

                        ${
                          outEscape(
                            row.sku
                          )
                        }

                      </div>


                      <div
                        class="small mt-1 break-all">

                        ${
                          outEscape(
                            row.name ||
                            row.sku
                          )
                        }

                      </div>

                    </div>


                    <span
                      class="badge ${statusClass}">

                      ${
                        outEscape(
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
                          outEscape(
                            outboundPeriodLabel()
                          )
                        }出货

                      </div>

                      <div
                        class="text-xl font-bold">

                        ${
                          outFormatNumber(
                            row.periodQty
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
                          outFormatNumber(
                            row.stockQty
                          )
                        }

                      </div>

                    </div>


                  </div>


                  <div
                    class="small mt-3">

                    出货次数：
                    ${
                      outFormatNumber(
                        row.shipmentCount
                      )
                    }

                    · 最后出货：
                    ${
                      outEscape(
                        lastText
                      )
                    }

                  </div>


                  <button
                    class="btn btn-gray w-full mt-3"
                    onclick='openOutboundSkuDetailV1(${JSON.stringify(row.sku)})'>

                    查看每日明细

                  </button>


                </div>
              `;

            }
          )
          .join('');
    };


  /* =========================================================
     SKU 每日出货明细
  ========================================================= */

  window.openOutboundSkuDetailV1 =
    async function(sku){


      if(
        !APP
          ?.warehouse
          ?.id
      ){
        return;
      }


      const range =
        getOutboundPeriodRange();


      openModal(`

        <h2
          class="text-xl font-bold mb-2">

          SKU 出货明细

        </h2>


        <div
          class="font-semibold break-all">

          ${
            outEscape(
              sku
            )
          }

        </div>


        <div
          class="small mt-1">

          ${
            outEscape(
              outboundPeriodLabel()
            )
          }

        </div>


        <div
          id="outboundDailyDetailV1"
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
        } =
        await APP.sb.rpc(
          'get_outbound_daily_v1',
          {

            p_warehouse_id:
              APP.warehouse.id,

            p_sku:
              sku,

            p_start:
              range.start
                .toISOString(),

            p_end:
              range.end
                .toISOString()
          }
        );


        if(error){
          throw error;
        }


        const container =
          document
            .getElementById(
              'outboundDailyDetailV1'
            );


        if(
          !container
        ){
          return;
        }


        const rows =
          data ||
          [];


        if(
          !rows.length
        ){

          container.innerHTML = `

            <div
              class="bg-gray-50 rounded-xl p-4 text-center text-gray-500">

              这个时间范围内没有出货

            </div>
          `;

          return;
        }


        container.innerHTML =
          rows
            .map(row=>`

              <div
                class="flex items-center justify-between border-b py-3">

                <div>

                  ${
                    outEscape(
                      row.out_date
                    )
                  }

                </div>


                <div
                  class="text-right">

                  <div
                    class="font-bold">

                    ${
                      outFormatNumber(
                        row.total_qty
                      )
                    } 件

                  </div>


                  <div
                    class="small">

                    ${
                      outFormatNumber(
                        row.shipment_count
                      )
                    } 次

                  </div>

                </div>

              </div>
            `)
            .join('');


      }catch(error){


        const container =
          document
            .getElementById(
              'outboundDailyDetailV1'
            );


        if(container){

          container.innerHTML = `

            <div
              class="text-red-600">

              ${
                outEscape(
                  error
                    ?.message ||
                  '读取失败'
                )
              }

            </div>
          `;
        }
      }
    };


  /* =========================================================
     补登记未入库出货
  ========================================================= */

  window.openManualOutboundV1 =
    function(){


      const now =
        new Date();


      const date =
        outLocalDateValue(
          now
        );


      const time =
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

          ➕ 补登记出货

        </h2>


        <div
          class="bg-yellow-50 rounded-xl p-3 text-sm mb-4">

          用于没有入库、但实际已经出货的商品。

          保存后只计入出货统计，

          不会增加或减少库存。

        </div>


        <label
          class="block text-sm font-semibold mb-2">

          SKU *

        </label>


        <input
          id="manualOutboundSkuV1"
          placeholder="输入 SKU">


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          商品名称（可不填）

        </label>


        <input
          id="manualOutboundNameV1"
          placeholder="商品名称">


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          出货数量 *

        </label>


        <input
          id="manualOutboundQtyV1"
          type="number"
          min="1"
          step="1"
          placeholder="数量">


        <div
          class="grid grid-cols-2 gap-2 mt-3">


          <div>

            <label
              class="block text-sm font-semibold mb-2">

              出货日期 *

            </label>

            <input
              id="manualOutboundDateV1"
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
              id="manualOutboundTimeV1"
              type="time"
              value="${time}">

          </div>


        </div>


        <label
          class="block text-sm font-semibold mb-2 mt-3">

          备注

        </label>


        <textarea
          id="manualOutboundNoteV1"
          rows="3"
          placeholder="例如：未入库直接出货">
        </textarea>


        <button
          class="btn btn-blue w-full mt-4"
          onclick="saveManualOutboundV1()">

          保存出货记录

        </button>


        <button
          class="btn btn-gray w-full mt-2"
          onclick="closeModal()">

          取消

        </button>
      `);
    };


  window.saveManualOutboundV1 =
    async function(){


      const sku =
        document
          .getElementById(
            'manualOutboundSkuV1'
          )
          ?.value
          .trim();


      const name =
        document
          .getElementById(
            'manualOutboundNameV1'
          )
          ?.value
          .trim() ||
        null;


      const qty =
        Math.floor(
          outSafeNumber(
            document
              .getElementById(
                'manualOutboundQtyV1'
              )
              ?.value,
            0
          )
        );


      const date =
        document
          .getElementById(
            'manualOutboundDateV1'
          )
          ?.value;


      const time =
        document
          .getElementById(
            'manualOutboundTimeV1'
          )
          ?.value ||
        '12:00';


      const note =
        document
          .getElementById(
            'manualOutboundNoteV1'
          )
          ?.value
          .trim() ||
        null;


      if(
        !sku
      ){

        return showError(
          'SKU不能为空'
        );
      }


      if(
        qty <= 0
      ){

        return showError(
          '数量必须大于0'
        );
      }


      if(
        !date
      ){

        return showError(
          '请选择出货日期'
        );
      }


      if(
        date <
        OUTBOUND_START_DATE
      ){

        return showError(
          '统计从2026-10-01开始'
        );
      }


      const shippedAt =
        new Date(
          `${date}T${time}:00`
        );


      if(
        Number.isNaN(
          shippedAt
            .getTime()
        )
      ){

        return showError(
          '出货时间格式错误'
        );
      }


      try{


        showInfo(
          '正在保存出货记录...'
        );


        const {
          error
        } =
        await APP.sb.rpc(
          'record_manual_outbound_v1',
          {

            p_warehouse_id:
              APP.warehouse.id,

            p_sku:
              sku,

            p_qty:
              qty,

            p_shipped_at:
              shippedAt
                .toISOString(),

            p_name:
              name,

            p_note:
              note
          }
        );


        if(error){
          throw error;
        }


        closeModal();


        showOk(
          '✅ 已补登记出货，不会改变库存'
        );


        await loadOutboundStatsV1();


      }catch(error){


        console.error(
          '补登记失败',
          error
        );


        showError(
          error
            ?.message ||
          '补登记失败'
        );
      }
    };


  /* =========================================================
     导出 Excel
  ========================================================= */

  window.exportOutboundExcelV1 =
    function(){


      const rows =
        getFilteredOutboundRows();


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


      const data =
        rows.map(
          (
            row,
            index
          )=>({

            '序号':
              index+1,

            'SKU':
              row.sku,

            '商品名称':
              row.name ||
              '',

            [`${outboundPeriodLabel()}出货量`]:
              Math.round(
                row.periodQty
              ),

            '出货次数':
              Math.round(
                row.shipmentCount
              ),

            '当前库存':
              Math.round(
                row.stockQty
              ),

            '最后出货时间':
              row.lastShippedAt

              ? new Date(
                  row.lastShippedAt
                )
                .toLocaleString(
                  'zh-CN'
                )

              : '从未出货',

            '未出货天数':
              row.daysSince ===
              null

              ? '从未出货'

              : row.daysSince
          })
        );


      const wb =
        XLSX.utils
          .book_new();


      const ws =
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


      const today =
        outLocalDateValue(
          new Date()
        );


      XLSX.writeFile(
        wb,
        `出货统计_${outboundPeriodLabel()}_${today}.xlsx`
      );
    };


  /* =========================================================
     初始化
  ========================================================= */

  function initOutboundModule(){

    injectOutboundUI();


    const today =
      outLocalDateValue(
        new Date()
      );


    OUTBOUND.customEnd =
      today;


    const startInput =
      document
        .getElementById(
          'outboundStartV1'
        );


    const endInput =
      document
        .getElementById(
          'outboundEndV1'
        );


    if(startInput){

      startInput.value =
        OUTBOUND_START_DATE;
    }


    if(endInput){

      endInput.value =
        today;
    }


    refreshOutboundPeriodButtons();


    setTimeout(
      ()=>{

        if(
          APP
            ?.currentPage ===
          'outbound'
        ){

          window
            .enforceCurrentPageVisibility();

          loadOutboundStatsV1();
        }

      },
      300
    );
  }


  if(
    document.readyState ===
    'loading'
  ){

    document
      .addEventListener(
        'DOMContentLoaded',
        initOutboundModule
      );

  }else{

    initOutboundModule();
  }

})();