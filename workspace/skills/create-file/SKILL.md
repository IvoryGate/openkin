---
skill-id: create-file
description: |
  创建文件，指定路径和内容。
permissions:
  read: ["."]
  net: []
  write: ["workspace"]
  env: ["SKILL_ARGS", "SKILL_ID"]
---

# Create File Skill

This skill allows you to create a file with specified content at a given path.

## Usage

Arguments:
- `path`: The full path where the file should be created
- `content`: The content to write to the file

## Example

```json
{
  "path": "/tmp/example.py",
  "content": "print('Hello, World!')"
}
```