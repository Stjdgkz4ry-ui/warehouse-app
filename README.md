<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>仓库管理</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #f5f6f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #222;
    }

    .app {
      max-width: 600px;
      margin: auto;
      padding: 20px 16px 40px;
    }

    h1 {
      font-size: 24px;
      margin: 10px 0 20px;
    }

    .search {
      width: 100%;
      padding: 15px;
      font-size: 17px;
      border: 1px solid #ddd;
      border-radius: 12px;
      outline: none;
      background: white;
    }

    .add {
      width: 100%;
      margin: 15px 0;
      padding: 14px;
      border: 0;
      border-radius: 12px;
      background: #1677ff;
      color: white;
      font-size: 17px;
      font-weight: bold;
    }

    .card {
      background: white;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.05);
    }

    .sku {
      font-size: 13px;
      color: #1677ff;
      font-weight: bold;
    }

    .name {
      font-size: 18px;
      font-weight: bold;
      margin: 6px 0 12px;
    }

    .info {
      line-height: 1.8;
      color: #555;
    }

    .location {
      color: #e67e22;
      font-weight: bold;
    }

    .empty {
      text-align: center;
      color: #999;
      padding: 50px 10px;
    }
  </style>
</head>

<body>

<div class="app">

  <h1>📦 仓库管理</h1>

  <input
    id="search"
    class="search"
    placeholder="搜索 SKU 或物品名称"
  >

  <button class="add" onclick="addItem()">
    ＋ 新增物品
  </button>

  <div id="list"></div>

</div>

<script>

  // 测试数据
  let items = [
    {
      sku: "SKU001",
      name: "测试物品",
      location: "A-01-01",
      stock: 20
    },
    {
      sku: "SKU002",
      name: "测试零件",
      location: "A-01-02",
      stock: 35
    }
  ];

  const search = document.getElementById("search");
  const list = document.getElementById("list");

  function render() {

    const keyword = search.value.trim().toLowerCase();

    const result = items.filter(item =>
      item.sku.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword)
    );

    if (result.length === 0) {
      list.innerHTML = '<div class="empty">没有找到物品</div>';
      return;
    }

    list.innerHTML = result.map(item => `
      <div class="card">

        <div class="sku">
          SKU：${item.sku}
        </div>

        <div class="name">
          ${item.name}
        </div>

        <div class="info">
          📍 库位：
          <span class="location">
            ${item.location}
          </span>
          <br>

          📦 库存：
          <strong>${item.stock}</strong>
        </div>

      </div>
    `).join("");

  }

  search.addEventListener("input", render);

  function addItem() {
    alert("下一步我们会加入新增物品功能");
  }

  render();

</script>

</body>
</html>