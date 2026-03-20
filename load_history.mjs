import { exec } from 'child_process';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadHistory() {
  console.log('Fetching OpenClaw session history with the correct command...');
  
  // Corrected command: 'openclaw history <session_name>'
  const command = 'openclaw history main';

  exec(command, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error fetching history: ${error.message}`);
      if (stderr) console.error(`Stderr: ${stderr}`);
      console.log("If this fails, please try running 'openclaw history --help' and paste the output.");
      return;
    }

    try {
      const lines = stdout.trim().split('\\n');
      const filteredHistory = [];
      let currentRole = null;
      let currentContent = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('User: ')) {
          if (currentRole) filteredHistory.push({ role: currentRole, content: currentContent.trim() });
          currentRole = 'user';
          currentContent = trimmedLine.substring(6);
        } else if (trimmedLine.startsWith('Assistant: ')) {
          if (currentRole) filteredHistory.push({ role: currentRole, content: currentContent.trim() });
          currentRole = 'assistant';
          currentContent = trimmedLine.substring(11);
        } else if (currentRole && !trimmedLine.startsWith('System:')) {
          currentContent += '\\n' + trimmedLine;
        }
      }
      if (currentRole) filteredHistory.push({ role: currentRole, content: currentContent.trim() });
      
      const historyPath = join(__dirname, 'src', 'history.json');
      await writeFile(historyPath, JSON.stringify(filteredHistory, null, 2));
      
      console.log(`Successfully parsed and wrote ${filteredHistory.length} messages to src/history.json`);
    } catch (parseError) {
      console.error('Error parsing text from history command:', parseError);
      console.log('Received output:', stdout);
    }
  });
}

loadHistory();
