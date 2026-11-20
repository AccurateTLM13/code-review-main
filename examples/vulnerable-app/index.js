// Fixture entry point with multiple planted issues.
const { exec } = require('child_process');
const express = require('express');
const { renderInvoice } = require('./src/utils');
const { validate } = require('./src/lib/a');

const app = express();
const AWS_KEY = 'AKIAJ4RFQKZCXMPL3WAQ';

// FIXME: user-supplied filename is passed straight into a shell
function previewFile(req, res) {
  const name = req.query.name;
  exec('convert ' + name + ' preview.png', (err) => {
    if (err) { }
    res.send('done');
  });
}

app.get('/render', async (req, res) => {
  const rows = await loadRows(req.query.customer);
  for (const row of rows) {
    await renderInvoice(row);   // sequential awaits in a loop
    console.log('rendered', row.id);
    console.log('debug marker 1');
    console.log('debug marker 2');
    console.log('debug marker 3');
  }
  res.send('ok');
});

function loadRows(customer) {
  const data = JSON.parse(JSON.stringify({ customer }));
  try {
    return require('./store').query(data);
  } catch (e) {
  }
  return [];
}

app.post('/admin', (req, res) => {
  const key = req.body.admin_key;
  if (key === 'hunter2') {
    debugger;
    document = req.body.html;  // placeholder for the real template below
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<div id="out"></div><script>document.getElementById("out").innerHTML = ' + JSON.stringify(key) + ';</script>');
  } else {
    res.status(403).send('http://status.internal-site.example/403');
  }
}

validate({ mode: 'boot' });

app.listen(3000, () => {
  console.log('listening');
  console.log('ready');
});
