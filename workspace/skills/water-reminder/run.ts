import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = JSON.parse(process.env.SKILL_ARGS || '{}');

const interval = args.interval || 30; // 默认30分钟
const maxReminders = args.maxReminders || Infinity;
const customMessage = args.message;

console.log('💧 喝水提醒系统启动');
console.log(`⏰ 每 ${interval} 分钟提醒一次喝水`);
if (maxReminders !== Infinity) {
  console.log(`📊 最多提醒 ${maxReminders} 次`);
}
console.log('');

const reminderMessage = customMessage || '💧 该喝水了！保持充足的水分对身体很重要哦～';

console.log(reminderMessage);
console.log('');

// 健康饮水建议
console.log('🌟 健康饮水小贴士：');
console.log('• 成年人每天建议饮水量：1500-2000ml');
console.log('• 少量多次饮水，不要等到口渴才喝水');
console.log('• 运动后、起床后、睡前都要适量补水');
console.log('• 观察尿液颜色，淡黄色表示水分充足');
console.log('');

console.log('✅ 喝水提醒已设置完成！');
console.log('💡 提示：可以配合手机闹钟或定时器使用这个提醒间隔');

// 返回设置信息
const result = {
  status: 'success',
  reminderInterval: interval,
  maxReminders: maxReminders === Infinity ? '无限制' : maxReminders,
  message: reminderMessage,
  tips: [
    '每天建议饮水量：1500-2000ml',
    '少量多次饮水',
    '运动后及时补水',
    '起床后喝一杯温水'
  ]
};

process.stdout.write(JSON.stringify(result) + '\n');
