const axios = require('axios');
axios.post('http://localhost:3000/api/workflows/executions/test/nodes/test/resume', { input: "test" })
  .then(res => console.log(res.status))
  .catch(err => console.error(err.message));
