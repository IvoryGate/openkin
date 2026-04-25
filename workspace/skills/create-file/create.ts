import { writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  const args = JSON.parse(process.env.SKILL_ARGS || '{}');
  const { path, content } = args;

  if (!path || !content) {
    console.error('Error: Both path and content are required');
    process.exit(1);
  }

  try {
    await writeFile(path, content, 'utf-8');
    console.log(`File created successfully at: ${path}`);
  } catch (error) {
    console.error(`Error creating file: ${error}`);
    process.exit(1);
  }
}

main();