const { execSync } = require('child_process');

async function test() {
  try {
    const res = await fetch('http://localhost:3006/api/tools');
    const data = await res.json();
    const tools = data.data;
    const ghTools = tools.filter(t => t.name.startsWith('github_'));
    console.log("GitHub tools:", ghTools.map(t => ({id: t.id, name: t.name, repoFullName: t.repoFullName})));
    
    if (ghTools.length > 0) {
      const targetTool = ghTools[0];
      console.log(`Executing ${targetTool.name}...`);
      
      const execRes = await fetch('http://localhost:3006/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: targetTool.id,
          parameters: {
            path: 'README.md'
          }
        })
      });
      console.log(await execRes.json());
    }
  } catch (err) {
    console.error(err);
  }
}
test();
