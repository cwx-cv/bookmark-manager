# 书签管理器浏览器插件

一个基于 Manifest V3 的 Chrome / Edge 插件，打开后会自动列出浏览器中已收藏的网址，并支持添加、修改、删除、搜索、文件夹管理以及 JSON / HTML 书签导入导出。

## 功能

- 自动读取并展示所有收藏网址
- 添加书签：可填写标题、网址，并选择保存到的文件夹
- 修改书签：可修改标题、网址和所在文件夹
- 删除书签：每个条目旁有“删除”按钮，删除前会确认
- 搜索书签：按标题或网址快速过滤
- 新建子文件夹：在当前选中的文件夹下创建新文件夹
- 重命名文件夹：修改选中文件夹的名称
- 导出 JSON：备份全部书签
- 导入 JSON：批量导入书签到当前选中的文件夹
- 导入 HTML：导入浏览器标准导出的 Netscape HTML 书签文件，并保留文件夹层级

## 安装方法（Chrome / Edge）

1. 打开浏览器扩展管理页面：
   - Chrome：地址栏输入 `chrome://extensions/`
   - Edge：地址栏输入 `edge://extensions/`
2. 打开右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本文件夹 `bookmark-manager-extension`。
4. 点击浏览器工具栏中的“书签管理器”图标即可使用。

## 导入文件格式

### JSON

导出的 JSON 文件可直接再次导入，也支持简化格式：

```json
[
  {
    "title": "示例网站",
    "url": "https://example.com"
  }
]
```

也可以使用导出的完整格式：

```json
{
  "version": 1,
  "bookmarks": [
    {
      "title": "示例网站",
      "url": "https://example.com",
      "folder": "书签栏"
    }
  ]
}
```

### HTML

支持浏览器书签管理器导出的标准 HTML 文件（Netscape Bookmark 格式），例如 Chrome 在 `chrome://bookmarks/` 中“导出书签”生成的文件。导入时会保留 `<H3>` 文件夹层级，并将其保存到当前添加表单中选中的文件夹下。

## 文件说明

- `manifest.json`：插件配置，声明书签权限和图标
- `popup.html`：弹出窗口界面
- `popup.css`：界面样式
- `popup.js`：书签读取、添加、修改、删除、搜索、文件夹管理和导入导出逻辑
- `icons/`：插件图标