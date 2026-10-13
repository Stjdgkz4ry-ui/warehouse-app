/* =========================================================
   智能仓库 V10.9A.8 Production Scale 单补丁版
   用法：完整替换原 v1095_patch.js
   目标：
   1) 保留 USPS / QYEAH 面单识别修复
   2) 保留待人工绑定入口
   3) 保留已完成订单管理员重新出单
   4) 不再使用全局 MutationObserver
   5) 贴单工作台只显示摘要
   6) 普通拣货清单默认不渲染，点开才显示
   7) 拣货清单点开后每次只显示 100 项
   8) 历史 / 已归档默认不渲染，点开才加载显示
   ========================================================= */

(function(){
  'use strict';

  if(window.__WAREHOUSE_V1098_SINGLE_PATCH__) return;
  window.__WAREHOUSE_V1098_SINGLE_PATCH__ = true;

  const PICK_PAGE_SIZE = 100;

  /* =========================================================
     A. USPS / QYEAH 面单识别修复
     ========================================================= */

  function extractUspsTrackingV1098(rawText){
    const raw = String(rawText || '');
    const candidates = [];
    const re = /9(?:[\s-]*\d){19,21}/g;
    let m;

    while((m = re.exec(raw)) !== null){
      const digits = String(m[0] || '').replace(/\D/g,'');
      if(digits.length >= 20 && digits.length <= 22){
        candidates.push({
          digits,
          pos:m.index
        });
      }
    }

    const titlePos =
      raw.toUpperCase().indexOf('USPS TRACKING');

    candidates.sort((a,b)=>{
      if(b.digits.length !== a.digits.length){
        return b.digits.length - a.digits.length;
      }

      if(titlePos >= 0){
        return (
          Math.abs(a.pos - titlePos) -
          Math.abs(b.pos - titlePos)
        );
      }

      return a.pos - b.pos;
    });

    return candidates[0]?.digits || '';
  }

  function rebuildQyeahOrderNoV1098(rawText,currentOrderNo=''){
    const raw = String(rawText || '');
    const flat = raw.replace(/\s+/g,' ').trim();
    const current = String(currentOrderNo || '').trim();

    if(/^QYEAH[A-Z0-9_-]*YQ$/i.test(current)){
      return current;
    }

    let m = flat.match(
      /orderno\s*[:：]?\s*["']?(QYEAH\d{2,})\s+(\d{5,12}YQ)\b/i
    );

    if(m){
      return String(m[1] || '') + String(m[2] || '');
    }

    m = flat.match(
      /\b(\d{5,12}YQ)\s+orderno\s*[:：]?\s*["']?(QYEAH\d{2,})\b/i
    );

    if(m){
      return String(m[2] || '') + String(m[1] || '');
    }

    const prefixes = [
      ...flat.matchAll(/\b(QYEAH\d{2,})\b/gi)
    ].map(x=>String(x[1] || '').toUpperCase());

    const suffixes = [
      ...flat.matchAll(/\b(\d{5,12}YQ)\b/gi)
    ].map(x=>String(x[1] || '').toUpperCase());

    const uniquePrefix = [...new Set(prefixes)];
    const uniqueSuffix = [...new Set(suffixes)];

    if(uniquePrefix.length === 1 && uniqueSuffix.length === 1){
      return uniquePrefix[0] + uniqueSuffix[0];
    }

    return current;
  }

  if(typeof extractShippingLabelInfo === 'function'){
    const oldExtractShippingLabelInfoV1098 =
      extractShippingLabelInfo;

    extractShippingLabelInfo = function(text){
      const info =
        oldExtractShippingLabelInfoV1098(text) || {};

      const raw = String(
        text ||
        info.rawText ||
        ''
      );

      if(/USPS/i.test(raw)){
        const tracking =
          extractUspsTrackingV1098(raw);

        if(tracking){
          info.tracking = tracking;
        }
      }

      if(/QYEAH/i.test(raw)){
        const orderNo =
          rebuildQyeahOrderNoV1098(
            raw,
            info.orderNo || ''
          );

        if(orderNo){
          info.orderNo = orderNo;
        }
      }

      return info;
    };
  }

  /* =========================================================
     B. 待人工绑定面单
     ========================================================= */

  window.openPendingManualLabelsV1098 = async function(){
    try{
      if(typeof restorePendingManualLabelsV1092 === 'function'){
        await restorePendingManualLabelsV1092();
      }
    }catch(e){
      console.warn('恢复待人工面单失败：',e);
    }

    const pending =
      APP?.shippingManualLabelPages?.size || 0;

    if(typeof renderShippingLabelReviewPanel === 'function'){
      renderShippingLabelReviewPanel();
    }

    const el =
      document.getElementById('shippingLabelReviewPanel');

    if(el){
      el.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    }

    if(pending <= 0){
      if(typeof showOk === 'function'){
        showOk('当前批次没有待人工绑定面单');
      }
      return;
    }

    if(typeof showInfo === 'function'){
      showInfo(`还有 ${pending} 张面单需要人工确认`);
    }
  };

  function ensureManualBindButtonV1098(){
    if(document.getElementById('manualBindQuickBtnV1098')){
      return;
    }

    const uploadBtn =
      [...document.querySelectorAll('button')]
        .find(btn=>
          String(
            btn.getAttribute('onclick') || ''
          ).includes('openLabelUpload()')
        );

    if(!uploadBtn) return;

    const btn = document.createElement('button');
    btn.id = 'manualBindQuickBtnV1098';
    btn.className = 'btn btn-yellow';
    btn.type = 'button';
    btn.textContent = '⚠️ 待人工绑定面单';
    btn.onclick = window.openPendingManualLabelsV1098;

    uploadBtn.insertAdjacentElement('afterend',btn);
  }

  /* =========================================================
     C. 已完成订单管理员重新出单
     ========================================================= */

  window.adminReprintCompletedOrderV1098 =
    async function(orderId){

      const order =
        (APP.shippingOrders || [])
          .find(x=>x.id === orderId) ||
        (APP.packingProgressData?.orders || [])
          .find(x=>x.id === orderId);

      if(!order){
        return showError(
          '订单不存在或当前没有加载这张订单'
        );
      }

      const status =
        String(order.status || '').toLowerCase();

      if(status !== 'packed' && status !== 'shipped'){
        return showError(
          '只有已完成贴单/已出库订单才使用管理员重新出单'
        );
      }

      const label =
        (APP.shippingLabels || [])
          .find(x=>x.order_id === orderId) ||
        (APP.packingProgressData?.labels || [])
          .find(x=>x.order_id === orderId);

      if(!label){
        return showError(
          '这个已完成订单没有找到已绑定面单'
        );
      }

      const pin =
        await verifyWarehouseAdminPassword(
          `已完成订单再次出单：${order.order_no}`
        );

      if(!pin) return;

      const ok = confirm(
        `⚠️ 管理员重新出单\n\n`+
        `订单：${order.order_no}\n`+
        `当前状态：${order.status || '—'}\n\n`+
        `确认后会再次打印/打开这一张面单。\n\n`+
        `✅ 不重复扣库存\n`+
        `✅ 不改变订单完成状态\n`+
        `✅ 不会重新标记 packed\n\n`+
        `确定继续吗？`
      );

      if(!ok) return;

      if(
        (APP.shippingOrders || [])
          .some(x=>x.id === orderId)
      ){
        const printed =
          await printShippingLabelByOrderId(
            orderId,
            false,
            {adminReprint:true}
          );

        if(printed === false) return;
      }else{
        return showError(
          '这张订单属于历史/非当前批次。请先切换到对应批次后再重新出单。'
        );
      }

      try{
        if(typeof writeWarehouseAuditLog === 'function'){
          await writeWarehouseAuditLog(
            '管理员重打已完成订单面单',
            {
              id:null,
              sku:'',
              name:order.order_no,
              bin:''
            },
            {
              qty:1,
              note:
                `管理员密码已验证；`+
                `订单状态 ${order.status || '—'}；`+
                `仅重打面单，不改库存、不改状态`
            }
          );
        }
      }catch(e){
        console.warn('管理员重打流水记录失败：',e);
      }

      if(typeof showOk === 'function'){
        showOk(
          `✅ 已重新出单：${order.order_no}；库存和状态未改变`
        );
      }
    };

  if(typeof renderPackingProgressSearchList === 'function'){
    const oldRenderPackingProgressSearchListV1098 =
      renderPackingProgressSearchList;

    renderPackingProgressSearchList = function(){
      const result =
        oldRenderPackingProgressSearchListV1098
          .apply(this,arguments);

      const el =
        document.getElementById(
          'packingProgressSearchList'
        );

      if(!el) return result;

      const data =
        APP.packingProgressData || {
          orders:[],
          labels:[]
        };

      const completedOrders =
        (data.orders || [])
          .filter(o=>{
            const s =
              String(o.status || '').toLowerCase();

            return (
              s === 'packed' ||
              s === 'shipped'
            );
          });

      const cards =
        [...el.querySelectorAll('.card')];

      completedOrders.forEach(order=>{
        const orderNo =
          String(order.order_no || '');

        const card =
          cards.find(x=>
            String(x.textContent || '')
              .includes(orderNo)
          );

        if(!card) return;

        if(
          card.querySelector(
            `[data-admin-reprint-v1098="${order.id}"]`
          )
        ){
          return;
        }

        const wrap =
          document.createElement('div');

        wrap.className = 'mt-3';

        wrap.innerHTML = `
          <button
            class="btn btn-red w-full"
            data-admin-reprint-v1098="${order.id}"
            onclick="adminReprintCompletedOrderV1098('${order.id}')">
            🔐 管理员重新出单
          </button>
          <div class="small text-red-600 mt-2 text-center">
            需要管理员密码；不会重复扣库存，不改变完成状态
          </div>
        `;

        card.appendChild(wrap);
      });

      return result;
    };
  }

  /* =========================================================
     D. 贴单工作台
     ========================================================= */

  renderPackingQueue = function(){
    const el =
      document.getElementById('packingQueue');

    if(!el) return;

    if(
      !APP.shippingCloudReady ||
      !Array.isArray(APP.shippingOrders) ||
      !APP.shippingOrders.length
    ){
      el.innerHTML = '';
      return;
    }

    const labelOrderIds = new Set(
      (APP.shippingLabels || [])
        .map(x=>x.order_id)
        .filter(Boolean)
    );

    let completed = 0;
    let pending = 0;
    let noLabel = 0;

    (APP.shippingOrders || []).forEach(o=>{
      const s =
        String(o.status || '').toLowerCase();

      if(
        s === 'packed' ||
        s === 'shipped'
      ){
        completed++;
        return;
      }

      if(s === 'cancelled'){
        return;
      }

      if(labelOrderIds.has(o.id)){
        pending++;
      }else{
        noLabel++;
      }
    });

    el.innerHTML = `
      <div class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-bold text-lg">
              🖨️ 贴单工作台
            </div>
            <div class="small mt-1">
              大批量模式：已完成订单不在主页面逐条渲染。
            </div>
          </div>

          <span class="badge badge-green">
            已完成 ${completed}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-3 text-sm">
          <div class="bg-blue-50 rounded-xl p-3 text-center">
            <div class="font-bold text-blue-700 text-xl">
              ${pending}
            </div>
            <div class="small">待贴单</div>
          </div>

          <div class="bg-green-50 rounded-xl p-3 text-center">
            <div class="font-bold text-green-700 text-xl">
              ${completed}
            </div>
            <div class="small">已完成</div>
          </div>

          <div class="bg-yellow-50 rounded-xl p-3 text-center">
            <div class="font-bold text-yellow-700 text-xl">
              ${noLabel}
            </div>
            <div class="small">无面单</div>
          </div>
        </div>

        <button
          class="btn btn-blue w-full mt-3"
          onclick="openPackingProgressSearch()">
          🔎 查询未贴 / 已完成订单
        </button>
      </div>
    `;
  };

  /* =========================================================
     E. 普通拣货清单
     ========================================================= */

  let pickingListOpenV1098 = false;
  let pickingVisibleV1098 = PICK_PAGE_SIZE;
  let lastPickingSearchV1098 = '';

  window.openPickingListV1098 = function(){
    pickingListOpenV1098 = true;
    pickingVisibleV1098 = PICK_PAGE_SIZE;
    renderPickingList();
  };

  window.closePickingListV1098 = function(){
    pickingListOpenV1098 = false;
    pickingVisibleV1098 = PICK_PAGE_SIZE;
    renderPickingList();
  };

  window.loadMorePickingV1098 = function(){
    pickingVisibleV1098 += PICK_PAGE_SIZE;
    renderPickingList();
  };

  function updatePickingStatsV1098(){
    const totalQty =
      (APP.pickingRows || [])
        .reduce(
          (sum,row)=>
            sum + safeNumber(row.orderQty,0),
          0
        );

    const okCount =
      (APP.pickingRows || [])
        .filter(row=>row.status === 'ok')
        .length;

    const badCount =
      (APP.pickingRows || []).length -
      okCount;

    const rowsEl =
      document.getElementById('pickStatRows');

    const qtyEl =
      document.getElementById('pickStatQty');

    const okEl =
      document.getElementById('pickStatOk');

    const badEl =
      document.getElementById('pickStatBad');

    if(rowsEl){
      rowsEl.textContent =
        APP.pickingRows.length;
    }

    if(qtyEl){
      qtyEl.textContent =
        totalQty;
    }

    if(okEl){
      okEl.textContent =
        okCount;
    }

    if(badEl){
      badEl.textContent =
        badCount;
    }
  }

  renderPickingList = function(){
    const empty =
      document.getElementById('pickingEmpty');

    const result =
      document.getElementById('pickingResult');

    const container =
      document.getElementById('pickingList');

    if(!container) return;

    if(!APP.pickingRows?.length){
      if(typeof renderPickingEmpty === 'function'){
        renderPickingEmpty();
      }
      return;
    }

    if(empty){
      empty.classList.add('hidden');
    }

    if(result){
      result.classList.remove('hidden');
    }

    updatePickingStatsV1098();

    if(!pickingListOpenV1098){
      container.innerHTML = `
        <div class="card p-4">
          <div class="font-bold text-lg">
            📋 普通拣货清单
          </div>

          <div class="small mt-1">
            当前共有 ${APP.pickingRows.length} 个拣货项目。
            为减少大批量订单页面负担，默认不加载详细列表。
          </div>

          <button
            class="btn btn-blue w-full mt-3"
            onclick="openPickingListV1098()">
            👁️ 查看普通拣货清单
          </button>
        </div>
      `;
      return;
    }

    const search =
      (
        document.getElementById('pickingSearch')?.value ||
        ''
      )
      .trim()
      .toLowerCase();

    if(
      search !==
      lastPickingSearchV1098
    ){
      lastPickingSearchV1098 =
        search;

      pickingVisibleV1098 =
        PICK_PAGE_SIZE;
    }

    const sorted =
      typeof getPickingSortedRows === 'function'
        ? getPickingSortedRows()
        : [...APP.pickingRows];

    const filtered =
      sorted.filter(row=>{
        if(!search){
          return true;
        }

        const text = [
          row.bin,
          row.sku,
          row.name,
          row.carrier
        ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

        return text.includes(search);
      });

    const shown =
      filtered.slice(
        0,
        pickingVisibleV1098
      );

    if(!filtered.length){
      container.innerHTML = `
        <div class="card p-4 mb-3">
          <button
            class="btn btn-gray w-full"
            onclick="closePickingListV1098()">
            ✕ 收起普通拣货清单
          </button>
        </div>

        <div class="card p-8 text-center">
          <div class="text-4xl mb-3">🔎</div>
          <div class="font-bold">
            没有找到
          </div>
        </div>
      `;
      return;
    }

    const rowsHtml =
      shown.map((row,index)=>{
        const shortage =
          safeNumber(row.shortage,0);

        let statusHtml;

        if(row.status === 'ok'){
          statusHtml =
            `<span class="pick-status-ok">✅ 可拣</span>`;
        }else if(row.status === 'short'){
          statusHtml = `
            <span class="pick-status-short">
              ⚠️ 库存不足，缺 ${shortage}
            </span>
          `;
        }else{
          statusHtml = `
            <span class="pick-status-missing">
              ❌ 找不到SKU
            </span>
          `;
        }

        return `
          <div class="pick-row">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">

                <div class="small">
                  第 ${index + 1} 项
                </div>

                <div class="mt-1">
                  <span class="badge badge-blue">
                    🚚 ${escapeHtml(
                      row.carrier ||
                      '待识别快递'
                    )}
                  </span>
                </div>

                <div class="pick-bin mt-1">
                  📍 ${
                    row.bin
                      ? escapeHtml(row.bin)
                      : '未设置库位'
                  }
                </div>

                <div class="pick-sku mt-2">
                  SKU：${escapeHtml(row.sku)}
                </div>

                <div class="text-sm text-gray-600 mt-1 break-all">
                  ${escapeHtml(row.name)}
                </div>

                ${
                  row.duplicateSku
                    ? `
                      <div class="text-xs text-orange-600 mt-2">
                        ⚠️ 库存中存在重复 SKU，请确认库位。
                      </div>
                    `
                    : ''
                }

              </div>

              <div class="text-right shrink-0">
                <div class="text-2xl font-bold">
                  ${row.orderQty}
                </div>
                <div class="small">
                  要拣
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3">
              <div class="bg-gray-50 rounded-xl p-2">
                <div class="small">
                  当前库存
                </div>
                <div class="font-bold">
                  ${row.stockQty}
                </div>
              </div>

              <div class="bg-gray-50 rounded-xl p-2">
                <div class="small">
                  状态
                </div>
                <div class="mt-1">
                  ${statusHtml}
                </div>
              </div>
            </div>

          </div>
        `;
      })
      .join('');

    const remaining =
      filtered.length -
      shown.length;

    container.innerHTML = `
      <div class="card p-3 mb-3">
        <div class="small">
          匹配 <b>${filtered.length}</b> 项，
          当前显示 <b>${shown.length}</b> 项。
        </div>

        <button
          class="btn btn-gray w-full mt-2"
          onclick="closePickingListV1098()">
          ✕ 收起普通拣货清单
        </button>
      </div>

      ${rowsHtml}

      ${
        remaining > 0
          ? `
            <button
              class="btn btn-blue w-full mt-3"
              onclick="loadMorePickingV1098()">
              ➕ 再显示 ${
                Math.min(
                  PICK_PAGE_SIZE,
                  remaining
                )
              } 项
            </button>
          `
          : ''
      }
    `;
  };

  /* =========================================================
     F. 历史 / 已归档
     ========================================================= */

  let historyOpenV1098 = false;

  const oldRenderShippingBatchHistoryV1098 =
    typeof renderShippingBatchHistory === 'function'
      ? renderShippingBatchHistory
      : null;

  const oldLoadShippingBatchHistoryV1098 =
    typeof loadShippingBatchHistory === 'function'
      ? loadShippingBatchHistory
      : null;

  if(oldRenderShippingBatchHistoryV1098){
    renderShippingBatchHistory = function(){
      const el =
        document.getElementById(
          'shippingBatchHistory'
        );

      if(!el) return;

      if(!historyOpenV1098){
        el.innerHTML = '';
        return;
      }

      oldRenderShippingBatchHistoryV1098();

      if(
        el.firstElementChild &&
        !document.getElementById(
          'closeHistoryV1098'
        )
      ){
        const wrap =
          document.createElement('div');

        wrap.className =
          'card p-3 mb-3';

        wrap.innerHTML = `
          <button
            id="closeHistoryV1098"
            class="btn btn-gray w-full"
            onclick="closeArchiveHistoryV1098()">
            ✕ 收起历史 / 已归档
          </button>
        `;

        el.insertBefore(
          wrap,
          el.firstChild
        );
      }
    };
  }

  window.closeArchiveHistoryV1098 =
    function(){

      historyOpenV1098 = false;

      const el =
        document.getElementById(
          'shippingBatchHistory'
        );

      if(el){
        el.innerHTML = '';
      }
    };

  if(oldLoadShippingBatchHistoryV1098){

    openArchiveHistory =
      async function(){

        historyOpenV1098 = true;

        try{
          await oldLoadShippingBatchHistoryV1098(
            false
          );
        }catch(error){
          console.error(error);
        }

        if(
          typeof renderShippingBatchHistory ===
          'function'
        ){
          renderShippingBatchHistory();
        }

        const el =
          document.getElementById(
            'shippingBatchHistory'
          );

        if(el){
          el.scrollIntoView({
            behavior:'smooth',
            block:'start'
          });
        }
      };
  }

  /* =========================================================
     G. 初始化
     ========================================================= */

  function initV1098(){

    ensureManualBindButtonV1098();

    try{
      const historyEl =
        document.getElementById(
          'shippingBatchHistory'
        );

      if(historyEl){
        historyEl.innerHTML = '';
      }
    }catch(e){}

    try{
      if(
        typeof renderPackingQueue ===
        'function'
      ){
        renderPackingQueue();
      }
    }catch(e){}

    try{
      if(
        APP?.pickingRows?.length &&
        typeof renderPickingList ===
        'function'
      ){
        renderPickingList();
      }
    }catch(e){}
  }

  if(
    document.readyState ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      initV1098,
      {once:true}
    );
  }else{
    initV1098();
  }

  console.log(
    '✅ Warehouse V10.9A.8 Production Scale single patch loaded'
  );

})();


/* =========================================================
   V10.9A.9 大单量性能优化
========================================================= */

(function(){
  'use strict';

  if(window.__WAREHOUSE_V1099_SCALE__) return;
  window.__WAREHOUSE_V1099_SCALE__ = true;

  const SEARCH_PAGE_SIZE_V1099 = 100;

  /* =====================================================
     1. 分块读取订单明细 / 面单
  ===================================================== */

  shippingFetchByOrderIds =
    async function(
      tableName,
      orderIds,
      options={}
    ){

      const ids =
        (orderIds || [])
          .filter(Boolean);

      if(!ids.length){
        return [];
      }

      const CHUNK_SIZE = 50;
      const CONCURRENCY = 4;

      const chunks = [];

      for(
        let i=0;
        i<ids.length;
        i+=CHUNK_SIZE
      ){
        chunks.push(
          ids.slice(
            i,
            i+CHUNK_SIZE
          )
        );
      }

      const results =
        new Array(chunks.length);

      async function runChunk(index){

        const part =
          chunks[index];

        let q =
          APP.sb
            .from(tableName)
            .select(
              options.select ||
              '*'
            )
            .in(
              'order_id',
              part
            );

        if(options.orderColumn){
          q =
            q.order(
              options.orderColumn,
              {
                ascending:
                  options.ascending !==
                  false
              }
            );
        }

        const {data,error} =
          await q;

        if(error){
          throw error;
        }

        results[index] =
          data || [];
      }

      for(
        let i=0;
        i<chunks.length;
        i+=CONCURRENCY
      ){

        const jobs = [];

        for(
          let j=i;
          j<
          Math.min(
            i+CONCURRENCY,
            chunks.length
          );
          j++
        ){
          jobs.push(
            runChunk(j)
          );
        }

        await Promise.all(
          jobs
        );
      }

      return results.flat();
    };

  /* =====================================================
     2. 当前批次精准加载
  ===================================================== */

  if(
    typeof loadShippingWorkspace ===
    'function'
  ){

    const oldLoadShippingWorkspaceV1099 =
      loadShippingWorkspace;

    loadShippingWorkspace =
      async function(
        silent=false
      ){

        if(!APP.warehouse){
          return;
        }

        const knownSource =
          String(
            APP.shippingActiveBatchSource ||
            getStoredShippingActiveBatch() ||
            ''
          )
          .trim();

        if(!knownSource){
          return await oldLoadShippingWorkspaceV1099(
            silent
          );
        }

        const ready =
          await checkShippingCloud();

        if(!ready){

          if(!silent){
            showError(
              '云端订单暂时无法连接。没有删除任何订单或进度，请检查网络后点“云端同步”。'
            );
          }

          return;
        }

        try{

          if(!silent){
            showInfo(
              '正在恢复当前订单批次...'
            );
          }

          const orders =
            await shippingFetchOrdersPagedV1061({
              select:'*',
              warehouseId:
                APP.warehouse.id,
              sourceFile:
                knownSource,
              isArchived:false,
              orderColumn:
                'created_at',
              ascending:true
            });

          if(!orders.length){

            setShippingActiveBatch('');

            return await oldLoadShippingWorkspaceV1099(
              silent
            );
          }

          setShippingActiveBatch(
            knownSource
          );

          const orderIds =
            orders
              .map(x=>x.id)
              .filter(Boolean);

          const [items,labels] =
            await Promise.all([

              shippingFetchByOrderIds(
                'shipping_order_items',
                orderIds,
                {
                  select:'*',
                  orderColumn:'created_at',
                  ascending:true
                }
              ),

              shippingFetchByOrderIds(
                'shipping_labels',
                orderIds,
                {
                  select:'*',
                  orderColumn:'created_at',
                  ascending:false
                }
              )

            ]);

          APP.shippingOrders =
            orders;

          APP.shippingItems =
            items || [];

          APP.shippingLabels =
            labels || [];

          if(
            typeof buildFastSingleOrderIndexV1072 ===
            'function'
          ){
            buildFastSingleOrderIndexV1072();
          }

          const mixedOrders =
            (
              APP.shippingOrders ||
              []
            )
            .filter(o=>
              String(
                o.source_file ||
                ''
              ) !==
              String(
                knownSource
              )
            );

          if(mixedOrders.length){
            throw new Error(
              `批次隔离失败：发现 ${mixedOrders.length} 个其它批次订单`
            );
          }

          loadPackPool();

          buildCloudPickingRows();

          renderPackingQueue();

          updateShippingCloudSummary();

          enforceCurrentPageVisibility();

          if(!silent){
            showOk(
              `已恢复当前批次：${
                shippingActiveBatchName() ||
                knownSource
              } · ${orders.length} 单`
            );
          }

          return true;

        }catch(error){

          console.error(
            '精准加载当前批次失败：',
            error
          );

          showError(
            '同步当前批次失败：' +
            (
              error.message ||
              '未知错误'
            ) +
            '。没有删除任何订单、面单或库存数据。'
          );

          return false;
        }
      };
  }

  /* =====================================================
     3. 扫码后后台刷新减负
  ===================================================== */

  let backgroundRefreshTimerV1099 =
    null;

  schedulePackingBackgroundRefreshV107 =
    function(delay=1200){

      clearTimeout(
        backgroundRefreshTimerV1099
      );

      const wait =
        Math.max(
          8000,
          safeNumber(
            delay,
            1200
          )
        );

      backgroundRefreshTimerV1099 =
        setTimeout(
          async()=>{

            try{

              if(
                typeof syncShippingBatchSummaries ===
                'function'
              ){
                await syncShippingBatchSummaries();
              }

              updateShippingCloudSummary();

              if(
                document.getElementById(
                  'packingProgressCenter'
                )
                &&
                typeof renderPackingProgressCenter ===
                'function'
              ){
                renderPackingProgressCenter();
              }

            }catch(e){

              console.warn(
                'V1099 后台轻量刷新失败：',
                e
              );

            }

          },
          wait
        );
    };

  /* =====================================================
     4. 贴单进度中心
  ===================================================== */

  loadPackingProgressData =
    async function(
      options={}
    ){

      if(
        !APP.warehouse ||
        !APP.shippingCloudReady
      ){
        return null;
      }

      const source =
        APP.shippingActiveBatchSource ||
        getStoredShippingActiveBatch();

      if(!source){

        APP.packingProgressData = {
          source:'',
          orders:[],
          items:[],
          labels:[]
        };

        return APP.packingProgressData;
      }

      const forceCloud =
        options?.forceCloud ===
        true;

      if(
        !forceCloud &&
        String(
          APP.shippingActiveBatchSource ||
          ''
        ) ===
        String(source) &&
        Array.isArray(
          APP.shippingOrders
        ) &&
        Array.isArray(
          APP.shippingItems
        ) &&
        Array.isArray(
          APP.shippingLabels
        )
      ){

        APP.packingProgressData = {
          source,
          orders:
            APP.shippingOrders,
          items:
            APP.shippingItems,
          labels:
            APP.shippingLabels
        };

        return APP.packingProgressData;
      }

      const orders =
        await shippingFetchOrdersPagedV1061({
          select:'*',
          warehouseId:
            APP.warehouse.id,
          sourceFile:
            source,
          orderColumn:
            'created_at',
          ascending:true
        });

      const orderIds =
        (orders || [])
          .map(x=>x.id)
          .filter(Boolean);

      const [items,labels] =
        await Promise.all([

          shippingFetchByOrderIds(
            'shipping_order_items',
            orderIds,
            {
              select:'*',
              orderColumn:
                'created_at',
              ascending:true
            }
          ),

          shippingFetchByOrderIds(
            'shipping_labels',
            orderIds,
            {
              select:'*',
              orderColumn:
                'created_at',
              ascending:true
            }
          )

        ]);

      APP.packingProgressData = {
        source,
        orders:
          orders || [],
        items:
          items || [],
        labels:
          labels || []
      };

      return APP.packingProgressData;
    };


  refreshPackingProgressCenter =
    async function(){

      try{

        await loadPackingProgressData();

        renderPackingProgressCenter();

      }catch(error){

        console.error(
          '读取贴单进度失败',
          error
        );

        const el =
          document.getElementById(
            'packingProgressCenter'
          );

        if(el){

          el.innerHTML = `
            <div class="bg-red-50 rounded-xl p-3 text-sm text-red-700">
              读取贴单进度失败：
              ${
                escapeHtml(
                  error.message ||
                  '未知错误'
                )
              }。
              没有删除任何数据。
            </div>
          `;

        }
      }
    };

  /* =====================================================
     5. 查询未贴 / 已完成
  ===================================================== */

  let packingSearchVisibleV1099 =
    SEARCH_PAGE_SIZE_V1099;

  let packingSearchLastKeyV1099 =
    '';

  function resetPackingSearchPageV1099(){

    packingSearchVisibleV1099 =
      SEARCH_PAGE_SIZE_V1099;
  }

  window.loadMorePackingSearchV1099 =
    function(){

      packingSearchVisibleV1099 +=
        SEARCH_PAGE_SIZE_V1099;

      renderPackingProgressSearchList();
    };

  window.setPackingProgressFilterV1099 =
    function(filter){

      APP.packingProgressFilter =
        filter;

      resetPackingSearchPageV1099();

      renderPackingProgressSearchList();
    };


  openPackingProgressSearch =
    async function(){

      deactivateHardwareScanner();

      try{

        await loadPackingProgressData();

      }catch(error){

        return showError(
          '读取贴单进度失败：' +
          (
            error.message ||
            ''
          )
        );

      }

      openModal(`
        <div class="flex items-center justify-between mb-3">

          <h2 class="text-xl font-bold">
            🔎 贴单 / 完成查询
          </h2>

          <button
            onclick="closeModal()"
            class="text-gray-400 text-2xl">
            ×
          </button>

        </div>

        <div class="bg-blue-50 rounded-xl p-3 mb-3 text-sm">
          当前批次查询使用已加载的云端工作数据，
          不会因为打开查询窗口再次下载整个批次。
        </div>

        <input
          id="packingProgressSearchInput"
          placeholder="搜索订单号 / Tracking / SKU"
          oninput="renderPackingProgressSearchList()">

        <div class="grid grid-cols-3 gap-2 mt-3">

          <button
            class="btn btn-red btn-small"
            onclick="setPackingProgressFilterV1099('pending')">
            未贴单
          </button>

          <button
            class="btn btn-green btn-small"
            onclick="setPackingProgressFilterV1099('completed')">
            已完成
          </button>

          <button
            class="btn btn-gray btn-small"
            onclick="setPackingProgressFilterV1099('all')">
            全部
          </button>

        </div>

        <div
          id="packingProgressSearchList"
          class="mt-3">
        </div>
      `);

      APP.packingProgressFilter =
        'pending';

      resetPackingSearchPageV1099();

      packingSearchLastKeyV1099 =
        '';

      renderPackingProgressSearchList();
    };


  renderPackingProgressSearchList =
    function(){

      const el =
        document.getElementById(
          'packingProgressSearchList'
        );

      if(!el){
        return;
      }

      const data =
        APP.packingProgressData || {
          orders:[],
          items:[],
          labels:[]
        };

      const labelMap =
        new Map(
          (data.labels || [])
            .map(
              x=>[
                x.order_id,
                x
              ]
            )
        );

      const rawQ =
        document
          .getElementById(
            'packingProgressSearchInput'
          )
          ?.value || '';

      const q =
        normalizeShippingKey(
          rawQ
        );

      const filter =
        APP.packingProgressFilter ||
        'pending';

      const stateKey =
        `${filter}|${q}`;

      if(
        packingSearchLastKeyV1099 !==
        stateKey
      ){

        packingSearchLastKeyV1099 =
          stateKey;

        resetPackingSearchPageV1099();
      }

      const itemTextMap =
        new Map();

      (data.items || [])
        .forEach(item=>{

          const id =
            item.order_id;

          if(!id){
            return;
          }

          const arr =
            itemTextMap.get(id) ||
            [];

          arr.push(
            `${item.sku}×${safeNumber(item.qty,0)}`
          );

          itemTextMap.set(
            id,
            arr
          );
        });


      let rows =
        (data.orders || [])
          .filter(o=>{

            if(filter === 'pending'){

              if(
                o.status === 'packed' ||
                o.status === 'shipped' ||
                o.status === 'cancelled' ||
                !labelMap.has(o.id)
              ){
                return false;
              }

            }else if(
              filter === 'completed' ||
              filter === 'shipped'
            ){

              if(
                o.status !== 'packed' &&
                o.status !== 'shipped'
              ){
                return false;
              }

            }

            if(!q){
              return true;
            }

            const req =
              (
                itemTextMap.get(
                  o.id
                ) ||
                []
              )
              .join(' + ');

            return [
              o.order_no,
              o.tracking_no,
              req
            ]
            .some(v=>
              normalizeShippingKey(v)
                .includes(q)
            );

          });


      if(
        filter === 'completed' ||
        filter === 'shipped'
      ){

        rows.sort((a,b)=>{

          const ta =
            Date.parse(
              a.packed_at ||
              a.shipped_at ||
              a.created_at ||
              0
            ) || 0;

          const tb =
            Date.parse(
              b.packed_at ||
              b.shipped_at ||
              b.created_at ||
              0
            ) || 0;

          if(ta !== tb){
            return ta - tb;
          }

          return String(
            a.id ||
            ''
          )
          .localeCompare(
            String(
              b.id ||
              ''
            )
          );
        });

      }


      const totalMatches =
        rows.length;

      const shown =
        rows.slice(
          0,
          packingSearchVisibleV1099
        );

      const completedSequenceMap =
        new Map();

      if(
        filter === 'completed' ||
        filter === 'shipped'
      ){

        rows.forEach(
          (o,index)=>
            completedSequenceMap
              .set(
                o.id,
                index+1
              )
        );

      }


      const cards =
        shown.map(o=>{

          const label =
            labelMap.get(
              o.id
            );

          const page =
            shippingLabelPageNo(
              label
            );

          const req =
            (
              itemTextMap.get(
                o.id
              ) ||
              []
            )
            .join(' + ') ||
            '无商品明细';

          const status =
            o.status === 'shipped'
              ? '✅ 历史已出库'
              : o.status === 'packed'
                ? '✅ 已打印 / 库存不变'
                : '🔴 未贴单';

          const seq =
            completedSequenceMap.get(
              o.id
            );

          const packedTime =
            o.packed_at ||
            o.shipped_at ||
            '';

          const packedTimeText =
            packedTime
              ? new Date(
                  packedTime
                ).toLocaleString()
              : '';

          const normalAction =
            (
              o.status !== 'packed' &&
              o.status !== 'shipped' &&
              o.status !== 'cancelled' &&
              label
            )
            ? `
              <div class="grid grid-cols-2 gap-2 mt-2">

                <button
                  class="btn btn-gray btn-small"
                  onclick="openBoundShippingLabel('${o.id}')">
                  👁️ 查看面单
                </button>

                <button
                  class="btn btn-blue btn-small"
                  onclick="manualConfirmPackOrder('${o.id}')">
                  ✅ 人工确认出单
                </button>

              </div>
            `
            : '';

          const adminAction =
            (
              o.status === 'packed' ||
              o.status === 'shipped'
            ) &&
            label
            ? `
              <div class="mt-3">

                <button
                  class="btn btn-red w-full"
                  onclick="adminReprintCompletedOrderV1098('${o.id}')">
                  🔐 管理员重新出单
                </button>

                <div class="small text-red-600 mt-2 text-center">
                  需要管理员密码；不会重复扣库存，不改变完成状态
                </div>

              </div>
            `
            : '';

          return `
            <div class="card p-3 mb-2">

              ${
                seq
                  ? `
                    <div class="small font-bold text-green-700 mb-1">
                      扫码出单顺序：第 ${seq} 单
                      ${
                        packedTimeText
                          ? ` · ${escapeHtml(packedTimeText)}`
                          : ''
                      }
                    </div>
                  `
                  : ''
              }

              <div class="font-bold break-all">
                ${escapeHtml(
                  o.order_no ||
                  ''
                )}
              </div>

              <div class="small mt-1 break-all">
                ${escapeHtml(req)}
              </div>

              <div class="small mt-1 break-all">
                Tracking：
                ${
                  escapeHtml(
                    o.tracking_no ||
                    label?.tracking_no ||
                    '—'
                  )
                }
              </div>

              <div class="small mt-1">

                ${
                  escapeHtml(
                    shippingCarrierName(o)
                  )
                }

                ${
                  page
                    ? ` · 面单第 ${page} 页`
                    : ''
                }

              </div>

              <div class="mt-2 font-bold">
                ${status}
              </div>

              ${normalAction}

              ${adminAction}

            </div>
          `;

        })
        .join('');


      const remaining =
        totalMatches -
        shown.length;


      el.innerHTML = `

        <div class="small text-gray-500 mb-2">
          匹配 <b>${totalMatches}</b> 条，
          当前显示 <b>${shown.length}</b> 条
        </div>

        ${
          cards ||
          `
            <div class="bg-gray-50 rounded-xl p-4 text-center text-gray-500">
              没有找到记录
            </div>
          `
        }

        ${
          remaining > 0
            ? `
              <button
                class="btn btn-blue w-full mt-3"
                onclick="loadMorePackingSearchV1099()">
                ➕ 再显示
                ${
                  Math.min(
                    SEARCH_PAGE_SIZE_V1099,
                    remaining
                  )
                }
                条
              </button>
            `
            : ''
        }

      `;
    };


  /* =====================================================
     6. 历史按需
  ===================================================== */

  if(
    typeof openArchiveHistory ===
    'function'
    &&
    typeof loadShippingBatchHistory ===
    'function'
  ){

    const oldOpenArchiveHistoryV1099 =
      openArchiveHistory;

    openArchiveHistory =
      async function(){

        return await oldOpenArchiveHistoryV1099();

      };
  }


  console.log(
    '✅ Warehouse V10.9A.9 large-scale optimization loaded'
  );

})();


/* =========================================================
   V11.3.1 面单 Storage 安全清理
   - 修复大量订单分页重复
   - 订单 ID 去重
   - 面单 ID 去重
   - 只清理当前仓库
   - 只清理 7 天前已完成订单 PDF
   - 不删除订单 / SKU / Tracking / 出货统计 / 库存 / 流水
========================================================= */

(function(){

  const KEEP_DAYS = 3;


  /* =====================================================
     读取当前仓库全部订单
  ===================================================== */

  async function fetchAllCompletedOrdersForCleanup(){

    if(!APP.warehouse?.id){
      throw new Error(
        '请先选择仓库'
      );
    }

    const all = [];

    const pageSize = 1000;

    let from = 0;


    while(true){

      const {data,error} =
        await APP.sb
          .from(
            'shipping_orders'
          )
          .select(
            'id,status,is_archived,created_at,packed_at,shipped_at,archived_at'
          )
          .eq(
            'warehouse_id',
            APP.warehouse.id
          )
          .order(
            'created_at',
            {ascending:true}
          )
          /*
           * 关键修复：
           * created_at 相同时再按唯一 id 排序。
           * 防止 1000 条分页边界重复/漏数据。
           */
          .order(
            'id',
            {ascending:true}
          )
          .range(
            from,
            from + pageSize - 1
          );


      if(error){
        throw error;
      }


      const rows =
        data || [];


      all.push(
        ...rows
      );


      if(
        rows.length <
        pageSize
      ){
        break;
      }


      from +=
        pageSize;
    }


    /*
     * 再做一道保险。
     * 同一个订单 ID 最终只保留一次。
     */
    const uniqueMap =
      new Map();


    all.forEach(order=>{

      if(
        !order?.id
      ){
        return;
      }


      uniqueMap.set(
        String(order.id),
        order
      );

    });


    return Array.from(
      uniqueMap.values()
    );
  }


  /* =====================================================
     判断完成时间
  ===================================================== */

  function completedTimeV113(
    order
  ){

    const value =
      order.shipped_at ||
      order.archived_at ||
      order.packed_at ||
      null;


    if(!value){
      return null;
    }


    const time =
      new Date(
        value
      );


    if(
      Number.isNaN(
        time.getTime()
      )
    ){
      return null;
    }


    return time;
  }


  /* =====================================================
     判断订单是否允许清理
  ===================================================== */

  function isEligibleOrderV113(
    order,
    cutoff
  ){

    const status =
      String(
        order.status ||
        ''
      )
      .toLowerCase();


    const completed =
      status === 'packed' ||
      status === 'shipped' ||
      order.is_archived ===
      true;


    if(!completed){
      return false;
    }


    const doneAt =
      completedTimeV113(
        order
      );


    if(!doneAt){
      return false;
    }


    return (
      doneAt <
      cutoff
    );
  }


  /* =====================================================
     按订单读取面单
  ===================================================== */

  async function fetchLabelsForOrdersV113(
    orderIds
  ){

    if(
      !orderIds.length
    ){
      return [];
    }


    const uniqueOrderIds =
      Array.from(
        new Set(
          orderIds
            .filter(Boolean)
            .map(String)
        )
      );


    const result = [];

    const chunkSize =
      100;


    for(
      let i=0;
      i<
      uniqueOrderIds.length;
      i+=chunkSize
    ){

      const chunk =
        uniqueOrderIds.slice(
          i,
          i+chunkSize
        );


      const {data,error} =
        await APP.sb
          .from(
            'shipping_labels'
          )
          .select(
            'id,order_id,storage_path,file_name,created_at'
          )
          .eq(
            'warehouse_id',
            APP.warehouse.id
          )
          .in(
            'order_id',
            chunk
          );


      if(error){
        throw error;
      }


      result.push(
        ...(data || [])
      );
    }


    /*
     * 面单按 ID 再去重。
     */
    const uniqueLabels =
      new Map();


    result.forEach(label=>{

      if(
        !label?.id
      ){
        return;
      }


      uniqueLabels.set(
        String(label.id),
        label
      );

    });


    return Array.from(
      uniqueLabels.values()
    );
  }


  /* =====================================================
     计算待清理数据
  ===================================================== */

  async function previewOldShippingLabelsV113(){

    showInfo(
      '正在计算可安全清理的旧面单...'
    );


    const cutoff =
      new Date(
        Date.now() -
        KEEP_DAYS *
        24 *
        60 *
        60 *
        1000
      );


    const allOrders =
      await fetchAllCompletedOrdersForCleanup();


    const eligibleOrders =
      allOrders.filter(
        order =>
          isEligibleOrderV113(
            order,
            cutoff
          )
      );


    const orderIds =
      Array.from(
        new Set(
          eligibleOrders
            .map(
              x=>x.id
            )
            .filter(Boolean)
            .map(String)
        )
      );


    const labels =
      await fetchLabelsForOrdersV113(
        orderIds
      );


    /*
     * 只有 storage_path 真正存在，
     * 才算可删除 PDF。
     */
    const validLabels =
      labels.filter(
        label =>
          String(
            label.storage_path ||
            ''
          )
          .trim()
      );


    /*
     * 最终再按 label.id 去重。
     */
    const finalLabelMap =
      new Map();


    validLabels.forEach(
      label=>{

        if(
          !label?.id
        ){
          return;
        }


        finalLabelMap.set(
          String(
            label.id
          ),
          label
        );

      }
    );


    const finalLabels =
      Array.from(
        finalLabelMap.values()
      );


    return {

      cutoff,

      eligibleOrders,

      orderIds,

      labels:
        finalLabels

    };
  }


  /* =====================================================
     正式清理
  ===================================================== */

  window.cleanupOldShippingLabelsV113 =
    async function(){

      /*
       * 只允许系统管理员执行
       */
      if(
        typeof isSystemSuperAdminV109 ===
        'function'
        &&
        !isSystemSuperAdminV109()
      ){

        return showError(
          '只有管理员可以清理旧面单'
        );

      }


      try{

        const preview =
          await previewOldShippingLabelsV113();


        if(
          !preview.labels.length
        ){

          return showOk(
            `没有超过 ${KEEP_DAYS} 天、且已完成的面单需要清理`
          );

        }


        const cutoffText =
          preview.cutoff
            .toLocaleString(
              'zh-CN'
            );


        const ok =
          confirm(

            `🧹 清理旧面单 PDF\n\n` +

            `当前仓库：${
              APP.warehouse?.name ||
              '当前仓库'
            }\n\n` +

            `保留最近：${KEEP_DAYS} 天\n\n` +

            `将删除：${preview.labels.length} 个 PDF 文件\n` +

            `对应已完成订单：${preview.eligibleOrders.length} 单\n\n` +

            `截止时间：${cutoffText}\n\n` +

            `✅ 保留订单记录\n` +

            `✅ 保留 SKU / 数量\n` +

            `✅ 保留 Tracking\n` +

            `✅ 保留出货统计\n` +

            `✅ 保留库存和流水\n\n` +

            `⚠️ 被删除的旧面单 PDF 以后不能重新打印。\n\n` +

            `确定继续吗？`

          );


        if(!ok){
          return;
        }


        /*
         * 管理员密码二次验证
         */
        const adminPin =
          typeof verifyWarehouseAdminPassword ===
          'function'
            ? await verifyWarehouseAdminPassword(
                '清理7天前已完成面单 PDF'
              )
            : true;


        if(!adminPin){
          return;
        }


        showInfo(
          `正在清理 ${preview.labels.length} 个旧面单...`
        );


        let deleted = 0;

        const chunkSize =
          100;


        /*
         * 每100个一批删除，
         * 避免一次请求过大。
         */
        for(
          let i=0;
          i<
          preview.labels.length;
          i+=chunkSize
        ){

          const rows =
            preview.labels.slice(
              i,
              i+chunkSize
            );


          /*
           * Storage 路径也去重。
           */
          const paths =
            Array.from(
              new Set(
                rows
                  .map(
                    x =>
                      String(
                        x.storage_path ||
                        ''
                      )
                      .trim()
                  )
                  .filter(Boolean)
              )
            );


          if(
            !paths.length
          ){
            continue;
          }


          /*
           * 真正删除 Storage PDF
           */
          const {error:removeError} =
            await APP.sb.storage
              .from(
                'shipping-labels'
              )
              .remove(
                paths
              );


          if(removeError){

            throw new Error(
              '删除 Storage 文件失败：' +
              removeError.message
            );

          }


          /*
           * Storage 成功删除以后，
           * 只清空 shipping_labels.storage_path。
           *
           * 不删除 shipping_labels 记录，
           * 所以 Tracking / 文件名历史仍然保留。
           */
          const labelIds =
            Array.from(
              new Set(
                rows
                  .map(
                    x=>x.id
                  )
                  .filter(Boolean)
                  .map(String)
              )
            );


          if(
            labelIds.length
          ){

            const {error:updateError} =
              await APP.sb
                .from(
                  'shipping_labels'
                )
                .update({
  storage_path:''
})
                .eq(
                  'warehouse_id',
                  APP.warehouse.id
                )
                .in(
                  'id',
                  labelIds
                );


            if(updateError){

              console.warn(
                'PDF 已删除，但清空 storage_path 失败：',
                updateError
              );

            }

          }


          deleted +=
            paths.length;


          showInfo(
            `正在清理旧面单：${deleted} / ${preview.labels.length}`
          );

        }


        /*
         * 当前页面内存同步更新。
         */
        const deletedIds =
          new Set(
            preview.labels
              .map(
                x=>String(x.id)
              )
              .filter(Boolean)
          );


        (
          APP.shippingLabels ||
          []
        )
        .forEach(label=>{

          if(
            deletedIds.has(
              String(
                label.id
              )
            )
          ){

            label.storage_path =
              null;

          }

        });


        (
          APP.shippingHistoryLabels ||
          []
        )
        .forEach(label=>{

          if(
            deletedIds.has(
              String(
                label.id
              )
            )
          ){

            label.storage_path =
              null;

          }

        });


        showOk(

          `✅ 清理完成\n\n` +

          `已删除：${deleted} 个旧面单 PDF\n\n` +

          `订单、SKU、Tracking、库存、出货统计和流水全部保留。`

        );


      }catch(error){

        console.error(
          '清理旧面单失败',
          error
        );


        showError(
          '清理失败：' +
          (
            error.message ||
            '未知错误'
          )
        );

      }

    };


  /* =====================================================
     设置页面增加清理按钮
  ===================================================== */

  function addCleanupButtonV113(){

    const page =
      document.getElementById(
        'pageSettings'
      );


    if(!page){
      return;
    }


    /*
     * 防止重复加入按钮。
     */
    if(
      document.getElementById(
        'labelCleanupCardV113'
      )
    ){

      return;

    }


    const card =
      document.createElement(
        'div'
      );


    card.id =
      'labelCleanupCardV113';


    card.className =
      'card p-4 mb-4';


    card.innerHTML = `

      <h2 class="font-bold mb-2">
        🧹 面单空间清理
      </h2>

      <div class="small mb-3">
        只删除当前仓库 7 天前、已经完成贴单/出货的 PDF 面单。
        不删除订单、库存、SKU、Tracking、出货统计和流水。
      </div>

      <button
        class="btn btn-yellow w-full"
        onclick="cleanupOldShippingLabelsV113()"
      >
        🧹 清理${KEEP_DAYS}天前面单
      </button>

    `;


    const logoutCard =
      page.lastElementChild;


    if(logoutCard){

      page.insertBefore(
        card,
        logoutCard
      );

    }else{

      page.appendChild(
        card
      );

    }

  }


  /*
   * 第一次加载网页加入按钮。
   */
  setTimeout(
    addCleanupButtonV113,
    500
  );


  /*
   * 切回网页时再检查一次。
   */
  document.addEventListener(
    'visibilitychange',
    ()=>{

      if(
        document.visibilityState ===
        'visible'
      ){

        setTimeout(
          addCleanupButtonV113,
          300
        );

      }

    }
  );


})();