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

      /*
       * 当前批次优先使用原打印函数。
       * markPacked=false：
       * 不 claim 新打印，不 finish 新状态，
       * 因此不会重复走正常完成流程。
       */
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
        /*
         * 历史查询数据不在当前 shippingOrders 时，
         * 暂不强行打印，防止跨批次误操作。
         */
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

  /*
   * 只在“查询未贴 / 已完成订单”每次正常渲染后，
   * 给已完成卡片追加管理员重新出单。
   * 不使用 MutationObserver。
   */
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
            return s === 'packed' || s === 'shipped';
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
     D. 贴单工作台：只显示摘要
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

      if(s === 'packed' || s === 'shipped'){
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
     E. 普通拣货清单：默认完全不渲染
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

    if(rowsEl) rowsEl.textContent = APP.pickingRows.length;
    if(qtyEl) qtyEl.textContent = totalQty;
    if(okEl) okEl.textContent = okCount;
    if(badEl) badEl.textContent = badCount;
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

    if(empty) empty.classList.add('hidden');
    if(result) result.classList.remove('hidden');

    updatePickingStatsV1098();

    /*
     * 默认状态：
     * 不生成任何 SKU 卡片。
     * 只有点“查看普通拣货清单”才渲染。
     */
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

    if(search !== lastPickingSearchV1098){
      lastPickingSearchV1098 = search;
      pickingVisibleV1098 = PICK_PAGE_SIZE;
    }

    const sorted =
      typeof getPickingSortedRows === 'function'
        ? getPickingSortedRows()
        : [...APP.pickingRows];

    const filtered =
      sorted.filter(row=>{
        if(!search) return true;

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
          <div class="font-bold">没有找到</div>
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
                    🚚 ${escapeHtml(row.carrier || '待识别快递')}
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
                <div class="small">要拣</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3">
              <div class="bg-gray-50 rounded-xl p-2">
                <div class="small">当前库存</div>
                <div class="font-bold">
                  ${row.stockQty}
                </div>
              </div>

              <div class="bg-gray-50 rounded-xl p-2">
                <div class="small">状态</div>
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
      filtered.length - shown.length;

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
              ➕ 再显示 ${Math.min(PICK_PAGE_SIZE,remaining)} 项
            </button>
          `
          : ''
      }
    `;
  };

  /* =========================================================
     F. 历史 / 已归档：默认不渲染
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
        document.getElementById('shippingBatchHistory');

      if(!el) return;

      if(!historyOpenV1098){
        el.innerHTML = '';
        return;
      }

      oldRenderShippingBatchHistoryV1098();

      if(
        el.firstElementChild &&
        !document.getElementById('closeHistoryV1098')
      ){
        const wrap =
          document.createElement('div');

        wrap.className = 'card p-3 mb-3';

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

  window.closeArchiveHistoryV1098 = function(){
    historyOpenV1098 = false;

    const el =
      document.getElementById('shippingBatchHistory');

    if(el){
      el.innerHTML = '';
    }
  };

  if(oldLoadShippingBatchHistoryV1098){
    openArchiveHistory = async function(){
      historyOpenV1098 = true;

      try{
        await oldLoadShippingBatchHistoryV1098(false);
      }catch(error){
        console.error(error);
      }

      if(typeof renderShippingBatchHistory === 'function'){
        renderShippingBatchHistory();
      }

      const el =
        document.getElementById('shippingBatchHistory');

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
        document.getElementById('shippingBatchHistory');

      if(historyEl){
        historyEl.innerHTML = '';
      }
    }catch(e){}

    try{
      if(typeof renderPackingQueue === 'function'){
        renderPackingQueue();
      }
    }catch(e){}

    try{
      if(
        APP?.pickingRows?.length &&
        typeof renderPickingList === 'function'
      ){
        renderPickingList();
      }
    }catch(e){}
  }

  if(document.readyState === 'loading'){
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