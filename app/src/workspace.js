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
