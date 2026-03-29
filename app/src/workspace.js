export function exportRequest(tab) {
  const data = {
    name: tab.name,
    method: tab.method,
    endpoint: tab.endpoint,
    headers: tab.headers,
    body: tab.body,
    context: tab.context,
    auth: tab.auth,
  };
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(tab.name || 'request').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

export function importRequest(onImport) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        onImport(data);
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/**
 * Normalizes a Postman Collection (v2.0 / v2.1) payload into an array of debugger Tabs.
 * It will recursively traverse `item` arrays to flatten nested folders.
 */
export function isPostmanCollection(json) {
  if (json?.info?.schema && json.info.schema.includes('postman')) return true;
  return false;
}

export function parsePostmanCollection(json) {
  const extractedTabs = [];

  function traverseItem(node) {
    if (node.item && Array.isArray(node.item)) {
      // It's a folder, traverse children
      node.item.forEach(child => traverseItem(child));
    } else if (node.request) {
      // It's a request!
      const req = node.request;
      
      let endpoint = '';
      if (typeof req.url === 'string') endpoint = req.url;
      else if (req.url && req.url.raw) endpoint = req.url.raw;

      let headers = [{ key: '', value: '', enabled: true }];
      if (req.header && Array.isArray(req.header) && req.header.length > 0) {
         headers = req.header.map(h => ({ key: h.key || '', value: h.value || '', enabled: h.disabled !== true }));
         headers.push({ key: '', value: '', enabled: true }); // keep empty slot at end
      }

      let body = '';
      if (req.body && req.body.raw) body = req.body.raw;

      const newTab = {
        name: node.name || 'Postman Request',
        mode: 'http',
        method: req.method || 'GET',
        endpoint: endpoint,
        headers: headers,
        body: body,
        context: JSON.stringify({ system: '', messages: [] }, null, 2),
        auth: { type: 'none', token: '', apiKey: { key: '', value: '', addTo: 'header' } },
        response: null,
        rawResponse: null,
        isError: false,
        loading: false,
        toolExecution: null
      };
      
      extractedTabs.push(newTab);
    }
  }

  if (json.item && Array.isArray(json.item)) {
    json.item.forEach(node => traverseItem(node));
  }

  return extractedTabs;
}
