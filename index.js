const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// ==================== JSON DATABASE ====================
const DB_FILE = './data.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = {
      coins: 500, bank: 0, level: 1, xp: 0,
      hunted: 0, fished: 0,
      daily_cd: 0, work_cd: 0, hunt_cd: 0, fish_cd: 0
    };
    saveDB(db);
  }
  return db[userId];
}

function saveUser(userId, updates) {
  const db = loadDB();
  if (!db[userId]) getUser(userId);
  Object.assign(db[userId], updates);
  saveDB(db);
}

function addXP(userId, amount) {
  const user = getUser(userId);
  let xp = user.xp + amount;
  let level = user.level;
  let leveledUp = false;
  if (xp >= level * 100) {
    xp -= level * 100;
    level++;
    leveledUp = true;
  }
  saveUser(userId, { xp, level });
  return leveledUp;
}

console.log('✅ Database JSON đã sẵn sàng!');

// ==================== HELPERS ====================
function getCooldown(user, field) {
  const remaining = (user[field] || 0) - Date.now();
  return remaining > 0 ? remaining : 0;
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==================== GIF LISTS ====================
const GIFS = {
  hug: [
    'https://media.tenor.com/images/62e0ef99af0a7e57de3ae8d81c46d5b9/tenor.gif',
    'https://media.tenor.com/images/56bd35547e07a3abb1a8b21f56a2caf9/tenor.gif',
    'https://media.tenor.com/images/f0e9aa87b2c38c2c4e5261ebf0b4e6c2/tenor.gif',
    'https://media.tenor.com/images/7fa4a1e11b6e36b7a50e4d3d9de34960/tenor.gif',
    'https://media.tenor.com/images/ed34bc1bb7af36c92e38e7b98dfa66f8/tenor.gif',
  ],
  pat: [
    'https://media.tenor.com/images/bc3c1994e36ba3c26bf1a7c3e05f86a5/tenor.gif',
    'https://media.tenor.com/images/e06c8d6b4e4bd35b8e84bf5c6c58ad80/tenor.gif',
    'https://media.tenor.com/images/ca5a6d4f2e4b8e6b5e85bc3e2e48f39d/tenor.gif',
    'https://media.tenor.com/images/1f9f3c8a1e6e3a9d4f5a0c3a7e6c3b5d/tenor.gif',
  ],
  slap: [
    'https://media.tenor.com/images/6ec78a62c4f8e3a7d0c9e5b1f2a4d8c3/tenor.gif',
    'https://media.tenor.com/images/3a7d0c9e5b1f2a4d8c6ec78a62c4f8e3/tenor.gif',
    'https://media.tenor.com/images/a4d8c6ec78a623a7d0c9e5b1f2c4f8e3/tenor.gif',
  ],
  kiss: [
    'https://media.tenor.com/images/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/tenor.gif',
    'https://media.tenor.com/images/b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1/tenor.gif',
    'https://media.tenor.com/images/c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2/tenor.gif',
  ],
  poke: [
    'https://media.tenor.com/images/d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3/tenor.gif',
    'https://media.tenor.com/images/e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4/tenor.gif',
  ],
  cry: [
    'https://media.tenor.com/images/f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5/tenor.gif',
    'https://media.tenor.com/images/a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6/tenor.gif',
  ],
  dance: [
    'https://media.tenor.com/images/b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7/tenor.gif',
    'https://media.tenor.com/images/c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8/tenor.gif',
  ],
  bite: [
    'https://media.tenor.com/images/d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9/tenor.gif',
    'https://media.tenor.com/images/e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0/tenor.gif',
  ],
};

// Nguồn GIF thật từ Nekos.Best API (không cần key)
const NEKO_ACTIONS = {
  hug:   'https://nekos.best/api/v2/hug',
  pat:   'https://nekos.best/api/v2/pat',
  kiss:  'https://nekos.best/api/v2/kiss',
  slap:  'https://nekos.best/api/v2/slap',
  poke:  'https://nekos.best/api/v2/poke',
  cry:   'https://nekos.best/api/v2/cry',
  dance: 'https://nekos.best/api/v2/dance',
  bite:  'https://nekos.best/api/v2/bite',
  wave:  'https://nekos.best/api/v2/wave',
  laugh: 'https://nekos.best/api/v2/laugh',
  blush: 'https://nekos.best/api/v2/blush',
  cuddle:'https://nekos.best/api/v2/cuddle',
};

async function fetchGif(action) {
  try {
    const res = await fetch(NEKO_ACTIONS[action]);
    const json = await res.json();
    return json.results[0].url;
  } catch {
    return null;
  }
}

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// ==================== WORDLE ====================
const WORDLE_WORDS = [
  'APPLE','BRAVE','CHESS','DANCE','EAGLE','FLAME','GRACE','HEART','IMAGE','JUICE',
  'KNIFE','LIGHT','MUSIC','NIGHT','OCEAN','PIZZA','QUEEN','RIVER','STONE','TIGER',
  'UNITY','VOICE','WATER','YOUTH','ZEBRA','BOOKS','CANDY','DREAM','EARTH','FRESH',
  'GIANT','HONEY','INDEX','JOKER','LEMON','MARCH','NURSE','OLIVE','PEARL','QUICK',
  'ROBOT','SOLAR','TRAIN','VIRAL','WRIST','ANGEL','BLAST','CLOUD','DISCO','ELITE',
  'KARMA','LASER','MAGIC','NOBLE','OPERA','POWER','RACER','SCOUT','TREND','BONUS'
];

const activeWordle = new Map();

function getWordleEmoji(letter, position, word) {
  if (word[position] === letter) return '🟩';
  if (word.includes(letter)) return '🟨';
  return '⬛';
}

function buildWordleDisplay(guesses, word) {
  let display = '';
  for (const guess of guesses) {
    let row = '';
    for (let i = 0; i < 5; i++) row += getWordleEmoji(guess[i], i, word);
    display += row + '  ' + guess.split('').join(' ') + '\n';
  }
  for (let i = guesses.length; i < 6; i++) display += '⬜⬜⬜⬜⬜\n';
  return display;
}

// ==================== HUNT & FISH ====================
const HUNT_ANIMALS = [
  { name: 'Thỏ',  emoji: '🐇', coins: [20, 50],    xp: 5,   rare: false },
  { name: 'Hươu', emoji: '🦌', coins: [50, 100],   xp: 10,  rare: false },
  { name: 'Gấu',  emoji: '🐻', coins: [100, 200],  xp: 20,  rare: false },
  { name: 'Hổ',   emoji: '🐯', coins: [200, 400],  xp: 40,  rare: false },
  { name: 'Rồng', emoji: '🐉', coins: [500, 1000], xp: 100, rare: true  },
];

const FISH_LIST = [
  { name: 'Cá Vàng', emoji: '🐠', coins: [10, 30],   xp: 3,  rare: false },
  { name: 'Cá Thu',  emoji: '🐟', coins: [30, 60],   xp: 6,  rare: false },
  { name: 'Cá Kiếm', emoji: '🐡', coins: [60, 120],  xp: 12, rare: false },
  { name: 'Cá Ngừ',  emoji: '🐋', coins: [120, 250], xp: 25, rare: false },
  { name: 'Cá Mập',  emoji: '🦈', coins: [300, 700], xp: 70, rare: true  },
];

function pickRandom(list) {
  const weights = list.map(i => i.rare ? 1 : 10);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = randomInt(0, total - 1);
  for (let i = 0; i < list.length; i++) {
    rand -= weights[i];
    if (rand < 0) return list[i];
  }
  return list[0];
}

// ==================== SLASH COMMANDS ====================
const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Xem số dư của bạn'),
  new SlashCommandBuilder().setName('daily').setDescription('Nhận thưởng hàng ngày'),
  new SlashCommandBuilder().setName('work').setDescription('Đi làm kiếm tiền'),
  new SlashCommandBuilder().setName('hunt').setDescription('Đi săn thú'),
  new SlashCommandBuilder().setName('fish').setDescription('Câu cá'),
  new SlashCommandBuilder().setName('deposit')
    .setDescription('Gửi tiền vào ngân hàng')
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('withdraw')
    .setDescription('Rút tiền từ ngân hàng')
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('pay')
    .setDescription('Chuyển tiền cho người khác')
    .addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('taixiu')
    .setDescription('Chơi Tài Xỉu')
    .addStringOption(o => o.setName('bet').setDescription('Tài hoặc Xỉu').setRequired(true)
      .addChoices({ name: '🔴 Tài', value: 'TÀI' }, { name: '🔵 Xỉu', value: 'XỈU' }))
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('wordle').setDescription('Chơi Wordle tiếng Anh'),
  new SlashCommandBuilder().setName('guess')
    .setDescription('Đoán từ trong Wordle')
    .addStringOption(o => o.setName('word').setDescription('Từ 5 chữ cái').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip')
    .setDescription('Tung đồng xu')
    .addStringOption(o => o.setName('choice').setDescription('Heads hoặc Tails').setRequired(true)
      .addChoices({ name: '🟡 Heads', value: 'heads' }, { name: '⚪ Tails', value: 'tails' }))
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('slots')
    .setDescription('Chơi máy đánh bạc')
    .addIntegerOption(o => o.setName('amount').setDescription('Số tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Bảng xếp hạng giàu nhất'),
  new SlashCommandBuilder().setName('profile').setDescription('Xem hồ sơ của bạn'),
  new SlashCommandBuilder().setName('8ball')
    .setDescription('Hỏi quả cầu ma thuật')
    .addStringOption(o => o.setName('question').setDescription('Câu hỏi của bạn').setRequired(true)),
  new SlashCommandBuilder().setName('rps')
    .setDescription('Kéo Búa Bao với Bot')
    .addStringOption(o => o.setName('choice').setDescription('Lựa chọn').setRequired(true)
      .addChoices({ name: '✂️ Kéo', value: 'scissors' }, { name: '✊ Búa', value: 'rock' }, { name: '✋ Bao', value: 'paper' })),
  new SlashCommandBuilder().setName('hug').setDescription('Ôm một người 🤗').addUserOption(o => o.setName('user').setDescription('Người bạn muốn ôm').setRequired(true)),
  new SlashCommandBuilder().setName('pat').setDescription('Vỗ đầu một người 👋').addUserOption(o => o.setName('user').setDescription('Người bạn muốn vỗ đầu').setRequired(true)),
  new SlashCommandBuilder().setName('slap').setDescription('Tát một người 💥').addUserOption(o => o.setName('user').setDescription('Người bạn muốn tát').setRequired(true)),
  new SlashCommandBuilder().setName('kiss').setDescription('Hôn một người 💋').addUserOption(o => o.setName('user').setDescription('Người bạn muốn hôn').setRequired(true)),
  new SlashCommandBuilder().setName('poke').setDescription('Chọc một người 👉').addUserOption(o => o.setName('user').setDescription('Người bạn muốn chọc').setRequired(true)),
  new SlashCommandBuilder().setName('bite').setDescription('Cắn một người 😈').addUserOption(o => o.setName('user').setDescription('Người bạn muốn cắn').setRequired(true)),
  new SlashCommandBuilder().setName('cuddle').setDescription('Ôm ấp một người 🥰').addUserOption(o => o.setName('user').setDescription('Người bạn muốn ôm ấp').setRequired(true)),
  new SlashCommandBuilder().setName('wave').setDescription('Vẫy tay chào 👋').addUserOption(o => o.setName('user').setDescription('Người bạn muốn chào').setRequired(false)),
  new SlashCommandBuilder().setName('cry').setDescription('Khóc 😢'),
  new SlashCommandBuilder().setName('dance').setDescription('Nhảy múa 💃'),
  new SlashCommandBuilder().setName('laugh').setDescription('Cười lăn 😂'),
  new SlashCommandBuilder().setName('blush').setDescription('Đỏ mặt 😳'),
  new SlashCommandBuilder().setName('help').setDescription('Xem danh sách lệnh'),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('Đang đăng ký slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Đã đăng ký xong slash commands!');
  } catch (error) {
    console.error('Lỗi đăng ký commands:', error);
  }
}

// ==================== BOT READY ====================
client.once('ready', () => {
  console.log(`✅ Bot ${client.user.tag} đã online!`);
  client.user.setActivity('🎮 /help', { type: 0 });
  registerCommands();
});

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user } = interaction;

  try {

    // -------- BALANCE --------
    if (commandName === 'balance') {
      const data = getUser(user.id);
      const embed = new EmbedBuilder()
        .setTitle(`💰 Ví tiền của ${user.displayName}`)
        .setColor(0xFFD700)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '👛 Ví',        value: `**${data.coins.toLocaleString()}** 🪙`, inline: true },
          { name: '🏦 Ngân hàng', value: `**${data.bank.toLocaleString()}** 🪙`,  inline: true },
          { name: '💎 Tổng',      value: `**${(data.coins + data.bank).toLocaleString()}** 🪙`, inline: true },
        )
        .setFooter({ text: `Level ${data.level} | XP: ${data.xp}/${data.level * 100}` });
      return interaction.reply({ embeds: [embed] });
    }

    // -------- DAILY --------
    else if (commandName === 'daily') {
      const data = getUser(user.id);
      const cd = getCooldown(data, 'daily_cd');
      if (cd > 0) return interaction.reply({ content: `⏳ Bạn đã nhận rồi! Còn **${formatTime(cd)}** nữa.`, ephemeral: true });
      const amount = randomInt(200, 500);
      saveUser(user.id, { coins: data.coins + amount, daily_cd: Date.now() + 24 * 60 * 60 * 1000 });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎁 Thưởng hàng ngày!').setColor(0x00FF88).setDescription(`Bạn nhận được **${amount}** 🪙!\nVí: **${(data.coins + amount).toLocaleString()}** 🪙`).setFooter({ text: 'Quay lại sau 24 giờ!' })] });
    }

    // -------- WORK --------
    else if (commandName === 'work') {
      const data = getUser(user.id);
      const cd = getCooldown(data, 'work_cd');
      if (cd > 0) return interaction.reply({ content: `⏳ Bạn đang mệt! Còn **${formatTime(cd)}** nữa.`, ephemeral: true });
      const jobs = [
        { job: 'Lập trình viên', emoji: '💻', min: 50,  max: 150 },
        { job: 'Người giao hàng', emoji: '🛵', min: 30,  max: 80  },
        { job: 'Đầu bếp',        emoji: '👨‍🍳', min: 40,  max: 120 },
        { job: 'Ca sĩ',          emoji: '🎤', min: 100, max: 300 },
        { job: 'Streamer',       emoji: '🎮', min: 80,  max: 200 },
      ];
      const job = jobs[randomInt(0, jobs.length - 1)];
      const amount = randomInt(job.min, job.max);
      addXP(user.id, 10);
      const freshData = getUser(user.id);
      saveUser(user.id, { coins: freshData.coins + amount, work_cd: Date.now() + 30 * 60 * 1000 });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${job.emoji} Đi làm: ${job.job}`).setColor(0x3498DB).setDescription(`Bạn kiếm được **${amount}** 🪙!`).setFooter({ text: 'Làm việc lại sau 30 phút!' })] });
    }

    // -------- HUNT --------
    else if (commandName === 'hunt') {
      const data = getUser(user.id);
      const cd = getCooldown(data, 'hunt_cd');
      if (cd > 0) return interaction.reply({ content: `⏳ Đang nạp đạn! Còn **${formatTime(cd)}**.`, ephemeral: true });
      if (Math.random() < 0.2) {
        saveUser(user.id, { hunt_cd: Date.now() + 20 * 60 * 1000 });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔫 Trượt rồi!').setColor(0xFF4444).setDescription('Bạn bắn hụt, không bắt được gì! 😅')] });
      }
      const animal = pickRandom(HUNT_ANIMALS);
      const coins = randomInt(animal.coins[0], animal.coins[1]);
      addXP(user.id, animal.xp);
      const freshData = getUser(user.id);
      saveUser(user.id, { coins: freshData.coins + coins, hunted: freshData.hunted + 1, hunt_cd: Date.now() + 20 * 60 * 1000 });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${animal.emoji} Đi Săn Thành Công!`).setColor(animal.rare ? 0xFFD700 : 0x2ECC71).setDescription(`Bạn săn được **${animal.name}** ${animal.emoji}${animal.rare ? '\n✨ **HIẾM!**' : ''}\nNhận được: **${coins}** 🪙`).setFooter({ text: 'Đi săn lại sau 20 phút!' })] });
    }

    // -------- FISH --------
    else if (commandName === 'fish') {
      const data = getUser(user.id);
      const cd = getCooldown(data, 'fish_cd');
      if (cd > 0) return interaction.reply({ content: `⏳ Đang thả câu! Còn **${formatTime(cd)}**.`, ephemeral: true });
      if (Math.random() < 0.15) {
        saveUser(user.id, { fish_cd: Date.now() + 15 * 60 * 1000 });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎣 Không câu được gì!').setColor(0xFF4444).setDescription('Cá không cắn câu hôm nay...')] });
      }
      const fish = pickRandom(FISH_LIST);
      const coins = randomInt(fish.coins[0], fish.coins[1]);
      addXP(user.id, fish.xp);
      const freshData = getUser(user.id);
      saveUser(user.id, { coins: freshData.coins + coins, fished: freshData.fished + 1, fish_cd: Date.now() + 15 * 60 * 1000 });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${fish.emoji} Câu Cá Thành Công!`).setColor(fish.rare ? 0xFFD700 : 0x3498DB).setDescription(`Bạn câu được **${fish.name}** ${fish.emoji}${fish.rare ? '\n✨ **HIẾM!**' : ''}\nNhận được: **${coins}** 🪙`).setFooter({ text: 'Câu cá lại sau 15 phút!' })] });
    }

    // -------- DEPOSIT --------
    else if (commandName === 'deposit') {
      const amount = interaction.options.getInteger('amount');
      const data = getUser(user.id);
      if (amount <= 0) return interaction.reply({ content: '❌ Số tiền phải lớn hơn 0!', ephemeral: true });
      if (data.coins < amount) return interaction.reply({ content: `❌ Bạn chỉ có **${data.coins}** 🪙 trong ví!`, ephemeral: true });
      saveUser(user.id, { coins: data.coins - amount, bank: data.bank + amount });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏦 Gửi tiền thành công!').setColor(0x00FF88).setDescription(`Đã gửi **${amount}** 🪙 vào ngân hàng.\nVí: **${data.coins - amount}** | Ngân hàng: **${data.bank + amount}**`)] });
    }

    // -------- WITHDRAW --------
    else if (commandName === 'withdraw') {
      const amount = interaction.options.getInteger('amount');
      const data = getUser(user.id);
      if (amount <= 0) return interaction.reply({ content: '❌ Số tiền phải lớn hơn 0!', ephemeral: true });
      if (data.bank < amount) return interaction.reply({ content: `❌ Ngân hàng chỉ có **${data.bank}** 🪙!`, ephemeral: true });
      saveUser(user.id, { coins: data.coins + amount, bank: data.bank - amount });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏦 Rút tiền thành công!').setColor(0x00FF88).setDescription(`Đã rút **${amount}** 🪙 từ ngân hàng.\nVí: **${data.coins + amount}** | Ngân hàng: **${data.bank - amount}**`)] });
    }

    // -------- PAY --------
    else if (commandName === 'pay') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (target.id === user.id) return interaction.reply({ content: '❌ Không thể chuyển tiền cho chính mình!', ephemeral: true });
      if (amount <= 0) return interaction.reply({ content: '❌ Số tiền phải lớn hơn 0!', ephemeral: true });
      const sender = getUser(user.id);
      if (sender.coins < amount) return interaction.reply({ content: `❌ Không đủ tiền! Bạn chỉ có **${sender.coins}** 🪙`, ephemeral: true });
      const receiver = getUser(target.id);
      saveUser(user.id, { coins: sender.coins - amount });
      saveUser(target.id, { coins: receiver.coins + amount });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('💸 Chuyển tiền thành công!').setColor(0x00FF88).setDescription(`**${user.displayName}** đã chuyển **${amount}** 🪙 cho **${target.displayName}**!`)] });
    }

    // -------- TAI XIU --------
    else if (commandName === 'taixiu') {
      const bet = interaction.options.getString('bet');
      const amount = interaction.options.getInteger('amount');
      const data = getUser(user.id);
      if (amount <= 0) return interaction.reply({ content: '❌ Tiền cược phải lớn hơn 0!', ephemeral: true });
      if (data.coins < amount) return interaction.reply({ content: `❌ Không đủ tiền! Bạn chỉ có **${data.coins}** 🪙`, ephemeral: true });
      const dice = [randomInt(1,6), randomInt(1,6), randomInt(1,6)];
      const sum = dice.reduce((a,b) => a+b, 0);
      const result = sum >= 11 ? 'TÀI' : 'XỈU';
      const won = bet === result;
      const newCoins = Math.max(0, won ? data.coins + amount : data.coins - amount);
      saveUser(user.id, { coins: newCoins });
      const emoji = dice.map(d => ['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'][d]).join(' ');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎲 Tài Xỉu').setColor(won ? 0x00FF88 : 0xFF4444).addFields({ name: '🎲 Xúc xắc', value: emoji }, { name: '🔢 Tổng điểm', value: `**${sum}** → **${result}**`, inline: true }, { name: '🎯 Cược', value: bet, inline: true }, { name: won ? '🏆 Thắng!' : '💸 Thua!', value: `${won ? '+' : '-'}**${amount}** 🪙\nVí: **${newCoins.toLocaleString()}** 🪙` })] });
    }

    // -------- WORDLE --------
    else if (commandName === 'wordle') {
      if (activeWordle.has(interaction.channelId)) return interaction.reply({ content: '⚠️ Đang có game Wordle! Dùng `/guess` để đoán.', ephemeral: true });
      const word = WORDLE_WORDS[randomInt(0, WORDLE_WORDS.length - 1)];
      activeWordle.set(interaction.channelId, { word, guesses: [], userId: user.id });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🟩 WORDLE').setColor(0x6AAA64).setDescription(`**${user.displayName}** đã bắt đầu!\nĐoán từ 5 chữ cái. Dùng \`/guess <từ>\`\n\n${buildWordleDisplay([], word)}`).addFields({ name: 'Ghi chú', value: '🟩 Đúng vị trí | 🟨 Có nhưng sai vị trí | ⬛ Không có' })] });
    }

    // -------- GUESS --------
    else if (commandName === 'guess') {
      const game = activeWordle.get(interaction.channelId);
      if (!game) return interaction.reply({ content: '❌ Không có game Wordle! Dùng `/wordle` để bắt đầu.', ephemeral: true });
      const guess = interaction.options.getString('word').toUpperCase();
      if (guess.length !== 5 || !/^[A-Z]+$/.test(guess)) return interaction.reply({ content: '❌ Phải nhập đúng 5 chữ cái tiếng Anh!', ephemeral: true });
      game.guesses.push(guess);
      const display = buildWordleDisplay(game.guesses, game.word);
      const won = guess === game.word;
      const lost = !won && game.guesses.length >= 6;
      if (won || lost) {
        activeWordle.delete(interaction.channelId);
        if (won) {
          const reward = (7 - game.guesses.length) * 50;
          const data = getUser(user.id);
          saveUser(user.id, { coins: data.coins + reward });
          return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎉 Thắng Wordle!').setColor(0x00FF88).setDescription(`Từ đúng: **${game.word}**\nThưởng: **${reward}** 🪙 (đoán ${game.guesses.length} lần)\n\n${display}`)] });
        }
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('😞 Game Over!').setColor(0xFF4444).setDescription(`Từ đúng là: **${game.word}**\n\n${display}`)] });
      }
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🟩 WORDLE').setColor(0x6AAA64).setDescription(`${display}\n📊 Còn **${6 - game.guesses.length}** lần đoán`).addFields({ name: 'Ghi chú', value: '🟩 Đúng vị trí | 🟨 Có nhưng sai vị trí | ⬛ Không có' })] });
    }

    // -------- COINFLIP --------
    else if (commandName === 'coinflip') {
      const choice = interaction.options.getString('choice');
      const amount = interaction.options.getInteger('amount');
      const data = getUser(user.id);
      if (amount <= 0) return interaction.reply({ content: '❌ Tiền cược phải lớn hơn 0!', ephemeral: true });
      if (data.coins < amount) return interaction.reply({ content: '❌ Không đủ tiền!', ephemeral: true });
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === result;
      saveUser(user.id, { coins: Math.max(0, won ? data.coins + amount : data.coins - amount) });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🪙 Tung đồng xu!').setColor(won ? 0x00FF88 : 0xFF4444).setDescription(`Kết quả: **${result === 'heads' ? '🟡 Heads' : '⚪ Tails'}**\n${won ? `🏆 Thắng **${amount}** 🪙!` : `💸 Thua **${amount}** 🪙!`}`)] });
    }

    // -------- SLOTS --------
    else if (commandName === 'slots') {
      const amount = interaction.options.getInteger('amount');
      const data = getUser(user.id);
      if (amount <= 0) return interaction.reply({ content: '❌ Tiền cược phải lớn hơn 0!', ephemeral: true });
      if (data.coins < amount) return interaction.reply({ content: '❌ Không đủ tiền!', ephemeral: true });
      const symbols = ['🍒','🍋','🍊','🍇','⭐','💎','7️⃣'];
      const weights =  [30,  25,  20,  15,   6,   3,   1 ];
      function spin() {
        const total = weights.reduce((a,b) => a+b, 0);
        let rand = randomInt(0, total - 1);
        for (let i = 0; i < symbols.length; i++) { rand -= weights[i]; if (rand < 0) return symbols[i]; }
        return symbols[0];
      }
      const reels = [spin(), spin(), spin()];
      let multiplier = 0;
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        if (reels[0] === '7️⃣') multiplier = 50;
        else if (reels[0] === '💎') multiplier = 20;
        else if (reels[0] === '⭐') multiplier = 10;
        else multiplier = 5;
      } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        multiplier = 2;
      } else { multiplier = -1; }
      const change = multiplier > 0 ? amount * multiplier : -amount;
      saveUser(user.id, { coins: Math.max(0, data.coins + change) });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎰 Máy Đánh Bạc').setColor(multiplier > 0 ? 0xFFD700 : 0xFF4444).setDescription(`┌─────────────┐\n│ ${reels.join(' │ ')} │\n└─────────────┘`).addFields({ name: multiplier > 0 ? `🏆 Thắng x${multiplier}!` : '💸 Thua!', value: `${multiplier > 0 ? '+' : ''}**${change}** 🪙\nVí: **${Math.max(0, data.coins + change).toLocaleString()}** 🪙` })] });
    }

    // -------- LEADERBOARD --------
    else if (commandName === 'leaderboard') {
      const db = loadDB();
      const sorted = Object.entries(db)
        .sort((a, b) => (b[1].coins + b[1].bank) - (a[1].coins + a[1].bank))
        .slice(0, 10);
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const desc = sorted.length
        ? sorted.map(([uid, d], i) => `${medals[i]} <@${uid}> — **${(d.coins + d.bank).toLocaleString()}** 🪙`).join('\n')
        : 'Chưa có ai!';
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Bảng xếp hạng').setColor(0xFFD700).setDescription(desc)] });
    }

    // -------- PROFILE --------
    else if (commandName === 'profile') {
      const data = getUser(user.id);
      const pct = Math.floor((data.xp / (data.level * 100)) * 10);
      const xpBar = '█'.repeat(pct) + '░'.repeat(10 - pct);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📋 Hồ sơ ${user.displayName}`).setColor(0x9B59B6).setThumbnail(user.displayAvatarURL()).addFields({ name: '💰 Ví', value: `${data.coins.toLocaleString()} 🪙`, inline: true }, { name: '🏦 Ngân hàng', value: `${data.bank.toLocaleString()} 🪙`, inline: true }, { name: '⭐ Level', value: `${data.level}`, inline: true }, { name: '📊 XP', value: `${xpBar} ${data.xp}/${data.level * 100}` }, { name: '🐾 Đã săn', value: `${data.hunted} lần`, inline: true }, { name: '🎣 Đã câu', value: `${data.fished} lần`, inline: true })] });
    }

    // -------- 8BALL --------
    else if (commandName === '8ball') {
      const question = interaction.options.getString('question');
      const answers = ['✅ Chắc chắn rồi!','✅ Đúng vậy!','✅ Có thể lắm!','🔮 Hỏi lại sau!','🔮 Tôi chưa chắc...','❌ Đừng mong đợi!','❌ Câu trả lời là KHÔNG!','❌ Rất nghi ngờ!'];
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎱 Quả Cầu Ma Thuật').setColor(0x2C2F33).addFields({ name: '❓ Câu hỏi', value: question }, { name: '🎱 Trả lời', value: answers[randomInt(0, answers.length-1)] })] });
    }

    // -------- RPS --------
    else if (commandName === 'rps') {
      const choice = interaction.options.getString('choice');
      const choices = ['rock','paper','scissors'];
      const botChoice = choices[randomInt(0,2)];
      const emojis = { rock:'✊', paper:'✋', scissors:'✂️' };
      const names  = { rock:'Búa', paper:'Bao', scissors:'Kéo' };
      let result;
      if (choice === botChoice) result = '🤝 Hòa!';
      else if ((choice==='rock'&&botChoice==='scissors')||(choice==='paper'&&botChoice==='rock')||(choice==='scissors'&&botChoice==='paper')) result = '🏆 Bạn thắng!';
      else result = '💸 Bot thắng!';
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('✊ Kéo Búa Bao').setColor(result.includes('Bạn') ? 0x00FF88 : result.includes('Hòa') ? 0xFFD700 : 0xFF4444).setDescription(`Bạn: ${emojis[choice]} ${names[choice]}\nBot: ${emojis[botChoice]} ${names[botChoice]}\n\n**${result}**`)] });
    }

    // -------- HUG --------
    else if (commandName === 'hug') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('hug');
      const embed = new EmbedBuilder()
        .setTitle('🤗 Ôm!')
        .setColor(0xFF69B4)
        .setDescription(`${user} đã ôm ${target}! 🤗\n*Ấm áp quá~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- PAT --------
    else if (commandName === 'pat') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('pat');
      const embed = new EmbedBuilder()
        .setTitle('👋 Vỗ đầu!')
        .setColor(0xFFD700)
        .setDescription(`${user} đã vỗ đầu ${target}! 👋\n*Ngoan lắm~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- SLAP --------
    else if (commandName === 'slap') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('slap');
      const embed = new EmbedBuilder()
        .setTitle('💥 TÁT!')
        .setColor(0xFF4444)
        .setDescription(`${user} đã tát ${target}! 💥\n*BPHWAAAPPP!!*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- KISS --------
    else if (commandName === 'kiss') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('kiss');
      const embed = new EmbedBuilder()
        .setTitle('💋 Hôn!')
        .setColor(0xFF1493)
        .setDescription(`${user} đã hôn ${target}! 💋\n*Ôi trời~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- POKE --------
    else if (commandName === 'poke') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('poke');
      const embed = new EmbedBuilder()
        .setTitle('👉 Chọc!')
        .setColor(0xFFA500)
        .setDescription(`${user} đã chọc ${target}! 👉\n*Này này này~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- BITE --------
    else if (commandName === 'bite') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('bite');
      const embed = new EmbedBuilder()
        .setTitle('😈 Cắn!')
        .setColor(0x8B0000)
        .setDescription(`${user} đã cắn ${target}! 😈\n*Ăn thịt người!*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- CUDDLE --------
    else if (commandName === 'cuddle') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('cuddle');
      const embed = new EmbedBuilder()
        .setTitle('🥰 Ôm ấp!')
        .setColor(0xFFB6C1)
        .setDescription(`${user} đã ôm ấp ${target}! 🥰\n*Dễ thương quá~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- WAVE --------
    else if (commandName === 'wave') {
      const target = interaction.options.getUser('user');
      await interaction.deferReply();
      const gif = await fetchGif('wave');
      const desc = target
        ? `${user} vẫy tay chào ${target}! 👋`
        : `${user} vẫy tay chào mọi người! 👋`;
      const embed = new EmbedBuilder()
        .setTitle('👋 Chào!')
        .setColor(0x00BFFF)
        .setDescription(desc + '\n*Xin chào~*');
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- CRY --------
    else if (commandName === 'cry') {
      await interaction.deferReply();
      const gif = await fetchGif('cry');
      const embed = new EmbedBuilder()
        .setTitle('😢 Khóc!')
        .setColor(0x4169E1)
        .setDescription(`${user} đang khóc... 😢\n*Đừng khóc nữa~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- DANCE --------
    else if (commandName === 'dance') {
      await interaction.deferReply();
      const gif = await fetchGif('dance');
      const embed = new EmbedBuilder()
        .setTitle('💃 Nhảy!')
        .setColor(0x9400D3)
        .setDescription(`${user} đang nhảy! 💃\n*Bắt đầu party~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- LAUGH --------
    else if (commandName === 'laugh') {
      await interaction.deferReply();
      const gif = await fetchGif('laugh');
      const embed = new EmbedBuilder()
        .setTitle('😂 Cười!')
        .setColor(0xFFFF00)
        .setDescription(`${user} đang cười lăn! 😂\n*HAHAHA!*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- BLUSH --------
    else if (commandName === 'blush') {
      await interaction.deferReply();
      const gif = await fetchGif('blush');
      const embed = new EmbedBuilder()
        .setTitle('😳 Đỏ mặt!')
        .setColor(0xFF6B6B)
        .setDescription(`${user} đang đỏ mặt! 😳\n*Shyyyy~*`);
      if (gif) embed.setImage(gif);
      return interaction.editReply({ embeds: [embed] });
    }

    // -------- HELP --------
    else if (commandName === 'help') {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📚 Danh sách lệnh').setColor(0x5865F2).setDescription('Bot Discord đa năng — dữ liệu lưu vĩnh viễn! 💾').addFields({ name: '💰 Kinh tế', value: '`/balance` `/daily` `/work` `/hunt` `/fish`\n`/deposit` `/withdraw` `/pay` `/leaderboard` `/profile`' }, { name: '🎮 Mini-game', value: '`/taixiu` `/wordle` `/guess` `/coinflip` `/slots` `/rps`' }, { name: '🎉 Tương tác (có GIF)', value: '`/hug` `/pat` `/slap` `/kiss` `/poke` `/bite` `/cuddle` `/wave` `/cry` `/dance` `/laugh` `/blush`' }, { name: '🎱 Khác', value: '`/8ball`' }).setFooter({ text: '💾 Dữ liệu lưu trong data.json — không mất khi restart!' })] });
    }

  } catch (err) {
    console.error('Lỗi command:', err);
    if (!interaction.replied) interaction.reply({ content: '❌ Có lỗi xảy ra! Thử lại sau.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
