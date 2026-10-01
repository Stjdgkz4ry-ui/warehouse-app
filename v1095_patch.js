/* =========================================================
   智能仓库 V10.9A.5 热修复
   目的：
   1) 修复 USPS 面单 QYEAH 订单号 / Tracking 被 PDF.js 拆乱的问题
   2) 出货中心增加固定“待人工绑定面单”入口
   3) 上传弹窗关闭后，待人工任务仍可重新打开
   4) 已完成/已贴单订单只有管理员密码验证后才能再次出单
   5) 管理员重打不改库存、不改订单状态，并记录流水
   ========================================================= */
(function(){
  'use strict';

  if(window.__WAREHOUSE_V1095_PATCHED__) return;
  window.__WAREHOUSE_V1095_PATCHED__ = true;

  function q(id){
    try{
      if(typeof window.$ === 'function') return window.$(id);
    }catch(e){}
    return document.getElementById(id);
  }

  function extractUspsTrackingV1095(rawText){
    const raw=String(rawText||'');
    const candidates=[];
    const re=/9(?:[\s-]*\d){19,21}/g;
    let m;

    while((m=re.exec(raw))!==null){
      const digits=String(m[0]||'').replace(/\D/g,'');
      if(digits.length>=20 && digits.length<=22){
        candidates.push({
          digits,
          pos:m.index
        });
      }
    }

    const titlePos=
      raw.toUpperCase().indexOf('USPS TRACKING');

    candidates.sort((a,b)=>{
      if(b.digits.length!==a.digits.length){
        return b.digits.length-a.digits.length;
      }

      if(titlePos>=0){
        return (
          Math.abs(a.pos-titlePos)-
          Math.abs(b.pos-titlePos)
        );
      }

      return a.pos-b.pos;
    });

    return candidates[0]?.digits || '';
  }

  function rebuildQyeahOrderNoV1095(
    rawText,
    currentOrderNo=''
  ){
    const raw=String(rawText||'');
    const flat=
      raw.replace(/\s+/g,' ').trim();

    if(
      /^QYEAH[A-Z0-9_-]*YQ$/i.test(
        String(currentOrderNo||'').trim()
      )
    ){
      return String(currentOrderNo||'').trim();
    }

    let m=flat.match(
      /orderno\s*[:：]?\s*["']?(QYEAH\d{2,})\s+(\d{5,12}YQ)\b/i
    );

    if(m){
      return (
        String(m[1]||'')+
        String(m[2]||'')
      );
    }

    m=flat.match(
      /\b(\d{5,12}YQ)\s+orderno\s*[:：]?\s*["']?(QYEAH\d{2,})\b/i
    );

    if(m){
      return (
        String(m[2]||'')+
        String(m[1]||'')
      );
    }

    const prefixes=[
      ...flat.matchAll(
        /\b(QYEAH\d{2,})\b/gi
      )
    ].map(
      x=>String(x[1]||'')
    );

    const suffixes=[
      ...flat.matchAll(
        /\b(\d{5,12}YQ)\b/gi
      )
    ].map(
      x=>String(x[1]||'')
    );

    const uniquePrefix=[
      ...new Set(
        prefixes.map(
          x=>x.toUpperCase()
        )
      )
    ];

    const uniqueSuffix=[
      ...new Set(
        suffixes.map(
          x=>x.toUpperCase()
        )
      )
    ];

    if(
      uniquePrefix.length===1 &&
      uniqueSuffix.length===1
    ){
      return (
        uniquePrefix[0]+
        uniqueSuffix[0]
      );
    }

    return String(
      currentOrderNo||''
    ).trim();
  }

  if(
    typeof window.extractShippingLabelInfo
    ===
    'function'
  ){
    const oldExtractShippingLabelInfo=
      window.extractShippingLabelInfo;

    window.extractShippingLabelInfo=
      function(text){

        const info=
          oldExtractShippingLabelInfo(text) || {};

        const raw=
          String(
            text||
            info.rawText||
            ''
          );

        if(/USPS/i.test(raw)){
          const uspsTracking=
            extractUspsTrackingV1095(raw);

          if(uspsTracking){
            info.tracking=
              uspsTracking;
          }
        }

        if(/QYEAH/i.test(raw)){
          const rebuilt=
            rebuildQyeahOrderNoV1095(
              raw,
              info.orderNo||''
            );

          if(rebuilt){
            info.orderNo=
              rebuilt;
          }
        }

        return info;
      };
  }

  window.openPendingManualLabelsV1095=
    async function(){

      try{
        if(
          typeof window
            .restorePendingManualLabelsV1092
          ===
          'function'
        ){
          await window
            .restorePendingManualLabelsV1092();
        }
      }catch(e){
        console.warn(
          '恢复待人工面单失败：',
          e
        );
      }

      const pending=
        window.APP
          ?.shippingManualLabelPages
          ?.size || 0;

      if(
        typeof window
          .renderShippingLabelReviewPanel
        ===
        'function'
      ){
        window
          .renderShippingLabelReviewPanel();
      }

      const el=
        q('shippingLabelReviewPanel');

      if(el){
        el.scrollIntoView({
          behavior:'smooth',
          block:'start'
        });
      }

      if(pending<=0){
        if(
          typeof window.showOk
          ===
          'function'
        ){
          window.showOk(
            '当前批次没有待人工绑定面单'
          );
        }
        return;
      }

      if(
        typeof window.showInfo
        ===
        'function'
      ){
        window.showInfo(
          `还有 ${pending} 张面单需要人工确认，已定位到处理入口`
        );
      }
    };

  function ensureManualBindButtonV1095(){

    if(
      document.getElementById(
        'manualBindQuickBtnV1095'
      )
    ){
      return;
    }

    const buttons=[
      ...document.querySelectorAll(
        'button'
      )
    ];

    const uploadBtn=
      buttons.find(btn=>
        String(
          btn.getAttribute(
            'onclick'
          )||''
        ).includes(
          'openLabelUpload()'
        )
      );

    if(!uploadBtn) return;

    const btn=
      document.createElement(
        'button'
      );

    btn.id=
      'manualBindQuickBtnV1095';

    btn.className=
      'btn btn-yellow';

    btn.type=
      'button';

    btn.innerHTML=
      '⚠️ 待人工绑定面单';

    btn.onclick=
      ()=>window
        .openPendingManualLabelsV1095();

    uploadBtn.insertAdjacentElement(
      'afterend',
      btn
    );
  }

  window.adminReprintCompletedOrderV1095=
    async function(orderId){

      const APP=
        window.APP;

      if(!APP) return;

      const order=
        (APP.shippingOrders||[])
          .find(
            x=>x.id===orderId
          );

      if(!order){
        return (
          typeof window.showError
          ===
          'function'
        )
        ? window.showError(
            '订单不存在或不在当前批次'
          )
        : undefined;
      }

      const status=
        String(
          order.status||''
        ).toLowerCase();

      if(
        ![
          'packed',
          'shipped'
        ].includes(status)
      ){
        return (
          typeof window.showError
          ===
          'function'
        )
        ? window.showError(
            '只有已经完成贴单/出库的订单才使用管理员重打'
          )
        : undefined;
      }

      const label=
        (APP.shippingLabels||[])
          .find(
            x=>
              x.order_id===orderId
          );

      if(!label){
        return (
          typeof window.showError
          ===
          'function'
        )
        ? window.showError(
            '这个已完成订单没有找到已绑定面单，不能重打'
          )
        : undefined;
      }

      if(
        typeof window
          .verifyWarehouseAdminPassword
        !==
        'function'
      ){
        return (
          typeof window.showError
          ===
          'function'
        )
        ? window.showError(
            '管理员密码功能没有加载'
          )
        : undefined;
      }

      const pin=
        await window
          .verifyWarehouseAdminPassword(
            `已完成订单再次出单：${order.order_no}`
          );

      if(!pin) return;

      const ok=
        window.confirm(
          `⚠️ 管理员再次出单\n\n`+
          `订单：${order.order_no}\n`+
          `状态：${order.status||'—'}\n\n`+
          `这会再打印/打开一张已经完成订单的面单。\n`+
          `不会重复扣库存，也不会改变订单状态。\n\n`+
          `确认继续吗？`
        );

      if(!ok) return;

      if(
        typeof window
          .printShippingLabelByOrderId
        !==
        'function'
      ){
        return (
          typeof window.showError
          ===
          'function'
        )
        ? window.showError(
            '打印函数没有加载'
          )
        : undefined;
      }

      const printed=
        await window
          .printShippingLabelByOrderId(
            orderId,
            false,
            {
              adminReprint:true
            }
          );

      if(printed===false) return;

      try{
        if(
          typeof window
            .writeWarehouseAuditLog
          ===
          'function'
        ){
          await window
            .writeWarehouseAuditLog(
              '管理员重打已完成订单面单',
              {
                id:null,
                sku:'',
                name:
                  order.order_no,
                bin:''
              },
              {
                qty:1,
                note:
                  `订单状态 ${order.status||'—'}；`+
                  `管理员密码已验证；`+
                  `仅重打面单，不改库存、不改状态`
              }
            );
        }
      }catch(e){
        console.warn(
          '管理员重打流水记录失败：',
          e
        );
      }

      if(
        typeof window.showOk
        ===
        'function'
      ){
        window.showOk(
          `✅ 管理员已重打：${order.order_no}；库存和订单状态未改变`
        );
      }
    };

  function protectCompletedOrderButtonsV1095(){

    const APP=
      window.APP;

    if(!APP) return;

    const packed=
      (APP.shippingOrders||[])
        .filter(o=>
          [
            'packed',
            'shipped'
          ].includes(
            String(
              o.status||''
            ).toLowerCase()
          )
        );

    packed.forEach(order=>{

      const selector=
        `button[onclick*="printShippingLabelByOrderId('${order.id}')"],`+
        `button[onclick*='printShippingLabelByOrderId("${order.id}")']`;

      document
        .querySelectorAll(
          selector
        )
        .forEach(btn=>{

          btn.classList.remove(
            'btn-blue'
          );

          btn.classList.add(
            'btn-red'
          );

          btn.textContent=
            '🔐 管理员重打';

          btn.setAttribute(
            'onclick',
            `adminReprintCompletedOrderV1095('${order.id}')`
          );
        });
    });
  }

  if(
    typeof window.renderPackingQueue
    ===
    'function'
  ){
    const oldRenderPackingQueue=
      window.renderPackingQueue;

    window.renderPackingQueue=
      function(){

        const result=
          oldRenderPackingQueue
            .apply(
              this,
              arguments
            );

        setTimeout(
          protectCompletedOrderButtonsV1095,
          0
        );

        return result;
      };
  }

  const observer=
    new MutationObserver(()=>{

      ensureManualBindButtonV1095();

      protectCompletedOrderButtonsV1095();

    });

  function initV1095(){

    ensureManualBindButtonV1095();

    protectCompletedOrderButtonsV1095();

    try{
      observer.observe(
        document.body,
        {
          childList:true,
          subtree:true
        }
      );
    }catch(e){}
  }

  if(
    document.readyState
    ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      initV1095,
      {
        once:true
      }
    );
  }else{
    initV1095();
  }

  console.log(
    '✅ Warehouse V10.9A.5 patch loaded'
  );

})();