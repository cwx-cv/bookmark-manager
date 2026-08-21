const summaryEl = document.getElementById('summary');
const listEl = document.getElementById('bookmark-list');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('search-input');

const formTitle = document.getElementById('form-title');
const newTitleInput = document.getElementById('new-title');
const newUrlInput = document.getElementById('new-url');
const folderSelect = document.getElementById('folder-select');
const addButton = document.getElementById('add-btn');
const cancelButton = document.getElementById('cancel-btn');
const formMessage = document.getElementById('form-message');

const manageFolderSelect = document.getElementById('manage-folder-select');
const folderNameInput = document.getElementById('folder-name-input');
const createFolderButton = document.getElementById('create-folder-btn');
const renameFolderButton = document.getElementById('rename-folder-btn');
const folderMessage = document.getElementById('folder-message');

const exportButton = document.getElementById('export-btn');
const importButton = document.getElementById('import-btn');
const importHtmlButton = document.getElementById('import-html-btn');
const importFile = document.getElementById('import-file');
const importHtmlFile = document.getElementById('import-html-file');
const actionMessage = document.getElementById('action-message');

let allBookmarks = [];
let folders = [];
let editingId = null;
let reloadTimer = null;

function flattenTree(nodes, parentTitle) {
  let result = [];
  nodes.forEach(function (node) {
    const currentTitle = node.title || '';
    if (node.url) {
      result.push({
        id: node.id,
        title: currentTitle || node.url,
        url: node.url,
        folder: parentTitle || '根目录',
        parentId: node.parentId || ''
      });
    }
    if (node.children && node.children.length) {
      result = result.concat(flattenTree(node.children, currentTitle || parentTitle));
    }
  });
  return result;
}

function collectFolders(nodes, depth, result) {
  const foldersResult = result || [];
  const level = depth || 0;
  nodes.forEach(function (node) {
    if (!node.url) {
      const label = node.title || (level === 0 ? '根目录' : '未命名文件夹');
      foldersResult.push({
        id: node.id,
        title: '\u3000'.repeat(level) + label,
        rawTitle: node.title || label
      });
      if (node.children && node.children.length) {
        collectFolders(node.children, level + 1, foldersResult);
      }
    }
  });
  return foldersResult;
}

function populateFolderSelect(selectEl, preferredId, keepSelection) {
  const previous = keepSelection ? selectEl.value : '';
  selectEl.innerHTML = '';

  folders.forEach(function (folder) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.title;
    selectEl.appendChild(option);
  });

  if (previous && folders.some(function (folder) {
    return folder.id === previous;
  })) {
    selectEl.value = previous;
    return;
  }

  const preferred = folders.find(function (folder) {
    return folder.id === preferredId;
  }) || folders[0];

  if (preferred) {
    selectEl.value = preferred.id;
  }
}

function renderFolders() {
  populateFolderSelect(folderSelect, '1', true);
  populateFolderSelect(manageFolderSelect, '1', true);
}

function renderBookmarks() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allBookmarks.filter(function (bookmark) {
    return !query ||
      bookmark.title.toLowerCase().indexOf(query) !== -1 ||
      bookmark.url.toLowerCase().indexOf(query) !== -1;
  });

  listEl.innerHTML = '';

  if (!filtered.length) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    summaryEl.textContent = '共 ' + allBookmarks.length + ' 个书签';
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;

  filtered.forEach(function (bookmark) {
    const li = document.createElement('li');
    li.className = 'bookmark-item';

    const link = document.createElement('a');
    link.className = 'bookmark-link';
    link.href = bookmark.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;

    const url = document.createElement('span');
    url.className = 'bookmark-url';
    url.textContent = bookmark.url;

    link.appendChild(title);
    link.appendChild(url);

    const folder = document.createElement('span');
    folder.className = 'bookmark-folder';
    folder.textContent = bookmark.folder;

    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.textContent = '修改';
    editButton.addEventListener('click', function () {
      startEdit(bookmark);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = '删除';
    deleteButton.addEventListener('click', function () {
      removeBookmark(bookmark.id);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    li.appendChild(link);
    li.appendChild(folder);
    li.appendChild(actions);
    listEl.appendChild(li);
  });

  summaryEl.textContent = '共 ' + allBookmarks.length + ' 个书签，当前显示 ' + filtered.length + ' 个';
}

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'message ' + (isError ? 'error' : 'success');
}

function showActionMessage(text, isError) {
  actionMessage.textContent = text;
  actionMessage.hidden = false;
  actionMessage.className = 'message ' + (isError ? 'error' : 'success');
}

function showFolderMessage(text, isError) {
  folderMessage.textContent = text;
  folderMessage.hidden = false;
  folderMessage.className = 'message ' + (isError ? 'error' : 'success');
}

function normalizeUrl(rawValue) {
  let url = rawValue.trim();
  if (!url) {
    return null;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'ftp:') {
      return null;
    }
    return { url: url, hostname: parsed.hostname };
  } catch (error) {
    return null;
  }
}

function buildDuplicateSet() {
  const seen = new Set();
  allBookmarks.forEach(function (bookmark) {
    seen.add(bookmark.parentId + '|' + bookmark.url);
  });
  return seen;
}

async function loadData() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }

  summaryEl.textContent = '正在读取书签...';
  try {
    const tree = await chrome.bookmarks.getTree();
    folders = collectFolders(tree);
    allBookmarks = flattenTree(tree);
    renderFolders();
    renderBookmarks();
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    summaryEl.textContent = '读取书签失败：' + message;
    allBookmarks = [];
    folders = [];
    renderFolders();
    renderBookmarks();
  }
}

function startEdit(bookmark) {
  editingId = bookmark.id;
  formTitle.textContent = '修改书签';
  newTitleInput.value = bookmark.title;
  newUrlInput.value = bookmark.url;
  if (bookmark.parentId && folders.some(function (folder) {
    return folder.id === bookmark.parentId;
  })) {
    folderSelect.value = bookmark.parentId;
  }
  addButton.textContent = '保存修改';
  cancelButton.hidden = false;
  newUrlInput.focus();
}

function resetForm() {
  editingId = null;
  formTitle.textContent = '添加书签';
  newTitleInput.value = '';
  newUrlInput.value = '';
  renderFolders();
  populateFolderSelect(folderSelect, '1', false);
  addButton.textContent = '添加';
  cancelButton.hidden = true;
  formMessage.hidden = true;
}

async function submitForm() {
  const normalized = normalizeUrl(newUrlInput.value);
  const title = newTitleInput.value.trim();

  if (!normalized) {
    showFormMessage('请输入正确的 http、https 或 ftp 网址', true);
    newUrlInput.focus();
    return;
  }

  const parentId = folderSelect.value || '1';
  const finalTitle = title || normalized.hostname;

  if (editingId) {
    const current = allBookmarks.find(function (bookmark) {
      return bookmark.id === editingId;
    });

    try {
      await chrome.bookmarks.update(editingId, { title: finalTitle, url: normalized.url });
      if (current && current.parentId && current.parentId !== parentId) {
        await chrome.bookmarks.move(editingId, { parentId: parentId });
      }
      resetForm();
      showFormMessage('修改成功');
      await loadData();
    } catch (error) {
      const message = error && error.message ? error.message : '未知错误';
      showFormMessage('修改失败：' + message, true);
    }
    return;
  }

  const alreadyExists = allBookmarks.some(function (bookmark) {
    return bookmark.parentId === parentId && bookmark.url === normalized.url;
  });

  if (alreadyExists) {
    showFormMessage('该文件夹中已存在相同网址', true);
    return;
  }

  try {
    await chrome.bookmarks.create({ parentId: parentId, title: finalTitle, url: normalized.url });
    newUrlInput.value = '';
    newTitleInput.value = '';
    showFormMessage('添加成功');
    await loadData();
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    showFormMessage('添加失败：' + message, true);
  }
}

async function removeBookmark(id) {
  const bookmark = allBookmarks.find(function (item) {
    return item.id === id;
  });

  if (!bookmark) {
    return;
  }

  if (!window.confirm('确定删除「' + bookmark.title + '」吗？')) {
    return;
  }

  try {
    await chrome.bookmarks.remove(id);
    showFormMessage('删除成功');
    await loadData();
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    showFormMessage('删除失败：' + message, true);
  }
}

async function createFolder() {
  const name = folderNameInput.value.trim();
  if (!name) {
    showFolderMessage('请输入文件夹名称', true);
    folderNameInput.focus();
    return;
  }

  const parentId = manageFolderSelect.value || '1';
  try {
    await chrome.bookmarks.create({ parentId: parentId, title: name });
    folderNameInput.value = '';
    showFolderMessage('文件夹创建成功');
    await loadData();
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    showFolderMessage('文件夹创建失败：' + message, true);
  }
}

async function renameFolder() {
  const folderId = manageFolderSelect.value;
  const name = folderNameInput.value.trim();

  if (!folderId || folderId === '0') {
    showFolderMessage('根目录不能重命名', true);
    return;
  }

  if (!name) {
    showFolderMessage('请输入新的文件夹名称', true);
    folderNameInput.focus();
    return;
  }

  try {
    await chrome.bookmarks.update(folderId, { title: name });
    folderNameInput.value = '';
    showFolderMessage('文件夹重命名成功');
    await loadData();
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    showFolderMessage('文件夹重命名失败：' + message, true);
  }
}

function exportBookmarks() {
  if (!allBookmarks.length) {
    showActionMessage('暂无可导出的书签', true);
    return;
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: allBookmarks.map(function (bookmark) {
      return {
        title: bookmark.title,
        url: bookmark.url,
        folder: bookmark.folder
      };
    })
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bookmarks-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);

  showActionMessage('已导出 ' + allBookmarks.length + ' 个书签');
}

async function importBookmarks() {
  const file = importFile.files && importFile.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.bookmarks) ? parsed.bookmarks : []);

    if (!items.length) {
      showActionMessage('文件中没有可导入的书签', true);
      importFile.value = '';
      return;
    }

    const parentId = folderSelect.value || '1';
    const seenUrls = buildDuplicateSet();
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      const rawValue = item.url || item.href || '';
      const normalized = normalizeUrl(rawValue);
      if (!normalized) {
        failed += 1;
        continue;
      }

      const key = parentId + '|' + normalized.url;
      if (seenUrls.has(key)) {
        skipped += 1;
        continue;
      }
      seenUrls.add(key);

      const title = item.title || item.name || normalized.hostname;
      try {
        await chrome.bookmarks.create({ parentId: parentId, title: title, url: normalized.url });
        added += 1;
      } catch (error) {
        failed += 1;
      }
    }

    showActionMessage('导入完成：成功 ' + added + ' 个，跳过 ' + skipped + ' 个，失败 ' + failed + ' 个', failed > 0);
    importFile.value = '';
    await loadData();
  } catch (error) {
    showActionMessage('导入失败：请选择有效的 JSON 文件', true);
    importFile.value = '';
  }
}

function directChildByTag(parent, tagName) {
  const children = parent.children;
  for (let i = 0; i < children.length; i += 1) {
    if (children[i].tagName === tagName) {
      return children[i];
    }
  }
  return null;
}

async function importHtmlLevel(dl, parentId, stats, seenUrls) {
  const children = dl.children;
  for (let i = 0; i < children.length; i += 1) {
    const dt = children[i];
    if (dt.tagName !== 'DT') {
      continue;
    }

    const heading = directChildByTag(dt, 'H3');
    const link = directChildByTag(dt, 'A');
    const childDl = directChildByTag(dt, 'DL');

    if (heading) {
      const folderTitle = (heading.textContent || '').trim() || '未命名文件夹';
      try {
        const folderNode = await chrome.bookmarks.create({ parentId: parentId, title: folderTitle });
        if (childDl) {
          await importHtmlLevel(childDl, folderNode.id, stats, seenUrls);
        }
      } catch (error) {
        stats.failed += 1;
      }
    } else if (link) {
      const href = link.getAttribute('href') || '';
      const title = (link.textContent || '').trim();
      const normalized = normalizeUrl(href);
      if (!normalized) {
        stats.failed += 1;
        continue;
      }

      const key = parentId + '|' + normalized.url;
      if (seenUrls.has(key)) {
        stats.skipped += 1;
        continue;
      }
      seenUrls.add(key);

      try {
        await chrome.bookmarks.create({ parentId: parentId, title: title || normalized.hostname, url: normalized.url });
        stats.added += 1;
      } catch (error) {
        stats.failed += 1;
      }
    }
  }
}

async function importHtmlBookmarks() {
  const file = importHtmlFile.files && importHtmlFile.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const rootDl = doc.querySelector('dl');
    if (!rootDl) {
      showActionMessage('导入失败：未找到 HTML 书签结构', true);
      importHtmlFile.value = '';
      return;
    }

    const parentId = folderSelect.value || '1';
    const stats = { added: 0, skipped: 0, failed: 0 };
    await importHtmlLevel(rootDl, parentId, stats, buildDuplicateSet());

    showActionMessage('导入完成：成功 ' + stats.added + ' 个书签，跳过 ' + stats.skipped + ' 个，失败 ' + stats.failed + ' 个', stats.failed > 0);
    importHtmlFile.value = '';
    await loadData();
  } catch (error) {
    showActionMessage('导入失败：请选择有效的 HTML 书签文件', true);
    importHtmlFile.value = '';
  }
}

function scheduleDataRefresh() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = setTimeout(function () {
    loadData();
  }, 150);
}

searchInput.addEventListener('input', renderBookmarks);
addButton.addEventListener('click', submitForm);
cancelButton.addEventListener('click', resetForm);
newUrlInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    submitForm();
  }
});

createFolderButton.addEventListener('click', createFolder);
renameFolderButton.addEventListener('click', renameFolder);
folderNameInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    createFolder();
  }
});

exportButton.addEventListener('click', exportBookmarks);
importButton.addEventListener('click', function () {
  importFile.click();
});
importFile.addEventListener('change', importBookmarks);
importHtmlButton.addEventListener('click', function () {
  importHtmlFile.click();
});
importHtmlFile.addEventListener('change', importHtmlBookmarks);

chrome.bookmarks.onCreated.addListener(scheduleDataRefresh);
chrome.bookmarks.onRemoved.addListener(scheduleDataRefresh);
chrome.bookmarks.onChanged.addListener(scheduleDataRefresh);
chrome.bookmarks.onMoved.addListener(scheduleDataRefresh);

document.addEventListener('DOMContentLoaded', loadData);