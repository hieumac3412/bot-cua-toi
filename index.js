const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// ==================== DATABASE ====================
const DB_FILE = './data.json';
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; }
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function getUser(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = { coins: 500, bank: 0, level: 1, xp: 0, hunted: 0, fished: 0, daily_cd: 0, work_cd: 0, hunt_cd: 0, fish_cd: 0, rob_cd: 0, lottery_cd: 0, streak: 0 };
    saveDB(db);
  }
  return db[userId];
}
function saveUser(userId, updates) {
  const db = loadDB(); if (!db[userId]) getUser(userId);
  Object.assign(db[userId], updates); saveDB(db);
}
function addXP(userId, amount) {
  const user = getUser(userId); let xp = user.xp + amount, level = user.level, up = false;
  if (xp >= level * 100) { xp -= level * 100; level++; up = true; }
  saveUser(userId, { xp, level }); return up;
}
console.log('✅ Database sẵn sàng!');

// ==================== HELPERS ====================
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function getCooldown(user, field) { const r = (user[field] || 0) - Date.now(); return r > 0 ? r : 0; }
function formatTime(ms) {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  if (h > 0) return `${h}h ${m%60}m ${s%60}s`; if (m > 0) return `${m}m ${s%60}s`; return `${s}s`;
}
function pickRandom(list, weights) {
  const w = weights || list.map(i => i.rare ? 1 : 10);
  const total = w.reduce((a,b)=>a+b,0); let rand = randomInt(0, total-1);
  for (let i = 0; i < list.length; i++) { rand -= w[i]; if (rand < 0) return list[i]; } return list[0];
}

// ==================== GIF API ====================
const NEKO_ACTIONS = {
  hug:'hug', pat:'pat', kiss:'kiss', slap:'slap', poke:'poke',
  cry:'cry', dance:'dance', bite:'bite', wave:'wave', laugh:'laugh', blush:'blush', cuddle:'cuddle'
};
async function fetchGif(action) {
  try { const r = await fetch(`https://nekos.best/api/v2/${action}`); const j = await r.json(); return j.results[0].url; }
  catch { return null; }
}

// ==================== GAME DATA ====================
const HUNT_ANIMALS = [
  { name:'Thỏ',  emoji:'🐇', coins:[20,50],    xp:5,   rare:false },
  { name:'Hươu', emoji:'🦌', coins:[50,100],   xp:10,  rare:false },
  { name:'Gấu',  emoji:'🐻', coins:[100,200],  xp:20,  rare:false },
  { name:'Hổ',   emoji:'🐯', coins:[200,400],  xp:40,  rare:false },
  { name:'Rồng', emoji:'🐉', coins:[500,1000], xp:100, rare:true  },
];
const FISH_LIST = [
  { name:'Cá Vàng',  emoji:'🐠', coins:[10,30],   xp:3,  rare:false },
  { name:'Cá Thu',   emoji:'🐟', coins:[30,60],   xp:6,  rare:false },
  { name:'Cá Kiếm',  emoji:'🐡', coins:[60,120],  xp:12, rare:false },
  { name:'Cá Ngừ',   emoji:'🐋', coins:[120,250], xp:25, rare:false },
  { name:'Cá Mập',   emoji:'🦈', coins:[300,700], xp:70, rare:true  },
];

// Bầu Cua
const BAU_CUA = [
  { name:'Bầu',  emoji:'🎃' },
  { name:'Cua',  emoji:'🦀' },
  { name:'Tôm',  emoji:'🦐' },
  { name:'Cá',   emoji:'🐟' },
  { name:'Gà',   emoji:'🐓' },
  { name:'Nai',  emoji:'🦌' },
];

// Bài Tây
const CARD_VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_SUITS  = ['♠','♥','♦','♣'];
function newDeck() {
  const deck = [];
  for (const s of CARD_SUITS) for (const v of CARD_VALUES) deck.push({ value: v, suit: s });
  return deck.sort(() => Math.random() - 0.5);
}
function cardScore(card) {
  if (['J','Q','K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}
function handScore(hand) {
  let score = hand.reduce((a, c) => a + cardScore(c), 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}
function cardStr(card) { return `${card.value}${card.suit}`; }
function handStr(hand) { return hand.map(cardStr).join(' '); }

// Câu hỏi trivia
const TRIVIA = [
  { q:'Thủ đô của Việt Nam là gì?', a:'hà nội', hint:'Bắt đầu bằng chữ H' },
  { q:'1 + 1 = ?', a:'2', hint:'Số nhỏ hơn 3' },
  { q:'Con vật nào kêu "meo meo"?', a:'mèo', hint:'Vật nuôi trong nhà' },
  { q:'Màu của bầu trời là gì?', a:'xanh', hint:'Màu của đại dương' },
  { q:'Ai là người tạo ra điện thoại?', a:'alexander graham bell', hint:'Người Scotland' },
  { q:'Trái đất có mấy mặt trăng?', a:'1', hint:'Số ít hơn 2' },
  { q:'Nước sôi ở bao nhiêu độ C?', a:'100', hint:'3 chữ số' },
  { q:'Con vật lớn nhất đại dương?', a:'cá voi xanh', hint:'Màu xanh' },
  { q:'Việt Nam có bao nhiêu tỉnh thành?', a:'63', hint:'Số lớn hơn 60' },
  { q:'Ngôn ngữ lập trình nào đang dùng cho bot này?', a:'javascript', hint:'Bắt đầu bằng J' },
  { q:'Planet lớn nhất hệ mặt trời?', a:'sao mộc', hint:'Tên một vị thần' },
  { q:'Công thức nước là gì?', a:'h2o', hint:'2 chữ cái + 1 số' },
  { q:'Ai viết Harry Potter?', a:'j.k. rowling', hint:'Tác giả người Anh' },
  { q:'Bóng đá có mấy cầu thủ mỗi đội?', a:'11', hint:'Số lẻ lớn hơn 10' },
  { q:'Kim cương cứng nhất thế giới được tính theo thang gì?', a:'mohs', hint:'Tên nhà khoáng vật học' },
];

// Hangman
const HANGMAN_WORDS = [
  { word:'DISCORD', hint:'Ứng dụng chat' },
  { word:'JAVASCRIPT', hint:'Ngôn ngữ lập trình' },
  { word:'ROBOT', hint:'Máy móc thông minh' },
  { word:'DRAGON', hint:'Con vật huyền thoại' },
  { word:'PIZZA', hint:'Món ăn Ý' },
  { word:'MUSIC', hint:'Âm thanh nghệ thuật' },
  { word:'GALAXY', hint:'Hệ thống sao' },
  { word:'NINJA', hint:'Chiến binh bí ẩn' },
  { word:'UNICORN', hint:'Con vật có sừng' },
  { word:'VAMPIRE', hint:'Hút máu ban đêm' },
];
const HANGMAN_STAGES = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

// Active games
const activeWordle   = new Map();
const activeBlackjack = new Map();
const activeTrivia   = new Map();
const activeHangman  = new Map();
const activeHighLow  = new Map();

// ==================== CLIENT ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// ==================== WORDLE ====================
const WORDLE_WORDS = ['APPLE','BRAVE','CHESS','DANCE','EAGLE','FLAME','GRACE','HEART','IMAGE','JUICE','KNIFE','LIGHT','MUSIC','NIGHT','OCEAN','PIZZA','QUEEN','RIVER','STONE','TIGER','UNITY','VOICE','WATER','YOUTH','ZEBRA','BOOKS','CANDY','DREAM','EARTH','FRESH','GIANT','HONEY','INDEX','JOKER','LEMON','MARCH','NURSE','OLIVE','PEARL','QUICK','ROBOT','SOLAR','TRAIN','VIRAL','WRIST','ANGEL','BLAST','CLOUD','DISCO','ELITE','KARMA','LASER','MAGIC','NOBLE','OPERA','POWER','RACER','SCOUT','TREND','BONUS'];
function wordleEmoji(l, i, w) { if(w[i]===l) return '🟩'; if(w.includes(l)) return '🟨'; return '⬛'; }
function wordleDisplay(guesses, word) {
  let d = '';
  for (const g of guesses) { let r=''; for(let i=0;i<5;i++) r+=wordleEmoji(g[i],i,word); d+=r+'  '+g.split('').join(' ')+'\n'; }
  for (let i=guesses.length;i<6;i++) d+='⬜⬜⬜⬜⬜\n';
  return d;
}

// ==================== SLASH COMMANDS ====================
const commands = [
  // Kinh tế
  new SlashCommandBuilder().setName('balance').setDescription('💰 Xem số dư'),
  new SlashCommandBuilder().setName('daily').setDescription('🎁 Nhận thưởng hàng ngày'),
  new SlashCommandBuilder().setName('work').setDescription('💼 Đi làm kiếm tiền'),
  new SlashCommandBuilder().setName('hunt').setDescription('🐾 Đi săn thú'),
  new SlashCommandBuilder().setName('fish').setDescription('🎣 Câu cá'),
  new SlashCommandBuilder().setName('deposit').setDescription('🏦 Gửi tiền vào ngân hàng').addIntegerOption(o=>o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('withdraw').setDescription('🏦 Rút tiền từ ngân hàng').addIntegerOption(o=>o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('pay').setDescription('💸 Chuyển tiền').addUserOption(o=>o.setName('user').setDescription('Người nhận').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Số tiền').setRequired(true)),
  new SlashCommandBuilder().setName('rob').setDescription('🦹 Cướp tiền người khác').addUserOption(o=>o.setName('user').setDescription('Nạn nhân').setRequired(true)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Bảng xếp hạng'),
  new SlashCommandBuilder().setName('profile').setDescription('📋 Xem hồ sơ'),
  // Games cờ bạc
  new SlashCommandBuilder().setName('taixiu').setDescription('🎲 Tài Xỉu').addStringOption(o=>o.setName('bet').setDescription('Tài/Xỉu').setRequired(true).addChoices({name:'🔴 Tài',value:'TÀI'},{name:'🔵 Xỉu',value:'XỈU'})).addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('baucua').setDescription('🎃 Bầu Cua Tôm Cá').addStringOption(o=>o.setName('bet').setDescription('Chọn con').setRequired(true).addChoices({name:'🎃 Bầu',value:'Bầu'},{name:'🦀 Cua',value:'Cua'},{name:'🦐 Tôm',value:'Tôm'},{name:'🐟 Cá',value:'Cá'},{name:'🐓 Gà',value:'Gà'},{name:'🦌 Nai',value:'Nai'})).addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 Tung đồng xu').addStringOption(o=>o.setName('choice').setDescription('Heads/Tails').setRequired(true).addChoices({name:'🟡 Heads',value:'heads'},{name:'⚪ Tails',value:'tails'})).addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('slots').setDescription('🎰 Máy đánh bạc').addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('blackjack').setDescription('🃏 Chơi Blackjack (21)').addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('hit').setDescription('🃏 Rút thêm bài Blackjack'),
  new SlashCommandBuilder().setName('stand').setDescription('🃏 Dừng rút bài Blackjack'),
  new SlashCommandBuilder().setName('highlow').setDescription('🃏 Cao Thấp - đoán bài').addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('lottery').setDescription('🎟️ Mua vé xổ số').addIntegerOption(o=>o.setName('amount').setDescription('Số vé (1-10)').setRequired(true)),
  new SlashCommandBuilder().setName('russianroulette').setDescription('🔫 Russian Roulette - liều lĩnh!').addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  new SlashCommandBuilder().setName('race').setDescription('🐎 Đua ngựa').addStringOption(o=>o.setName('horse').setDescription('Chọn ngựa').setRequired(true).addChoices({name:'🐎 Ngựa 1',value:'1'},{name:'🐎 Ngựa 2',value:'2'},{name:'🐎 Ngựa 3',value:'3'},{name:'🐎 Ngựa 4',value:'4'})).addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  // Games trí tuệ
  new SlashCommandBuilder().setName('wordle').setDescription('🟩 Chơi Wordle'),
  new SlashCommandBuilder().setName('guess').setDescription('🟩 Đoán từ Wordle').addStringOption(o=>o.setName('word').setDescription('Từ 5 chữ cái').setRequired(true)),
  new SlashCommandBuilder().setName('trivia').setDescription('❓ Câu hỏi đố vui'),
  new SlashCommandBuilder().setName('answer').setDescription('❓ Trả lời câu hỏi trivia').addStringOption(o=>o.setName('answer').setDescription('Câu trả lời').setRequired(true)),
  new SlashCommandBuilder().setName('hangman').setDescription('🎯 Chơi Đoán Chữ (Hangman)'),
  new SlashCommandBuilder().setName('letter').setDescription('🎯 Đoán chữ trong Hangman').addStringOption(o=>o.setName('letter').setDescription('1 chữ cái').setRequired(true)),
  new SlashCommandBuilder().setName('number').setDescription('🔢 Đoán số (1-100)').addIntegerOption(o=>o.setName('guess').setDescription('Số bạn đoán').setRequired(true)),
  new SlashCommandBuilder().setName('startnumber').setDescription('🔢 Bắt đầu game đoán số'),
  new SlashCommandBuilder().setName('rps').setDescription('✊ Kéo Búa Bao').addStringOption(o=>o.setName('choice').setDescription('Lựa chọn').setRequired(true).addChoices({name:'✂️ Kéo',value:'scissors'},{name:'✊ Búa',value:'rock'},{name:'✋ Bao',value:'paper'})),
  new SlashCommandBuilder().setName('8ball').setDescription('🎱 Quả cầu ma thuật').addStringOption(o=>o.setName('question').setDescription('Câu hỏi').setRequired(true)),
  new SlashCommandBuilder().setName('roll').setDescription('🎲 Tung xúc xắc').addIntegerOption(o=>o.setName('sides').setDescription('Số mặt (mặc định 6)').setRequired(false)),
  new SlashCommandBuilder().setName('cf').setDescription('🪙 Coinflip nhanh').addIntegerOption(o=>o.setName('amount').setDescription('Tiền cược').setRequired(true)),
  // Tương tác GIF
  new SlashCommandBuilder().setName('hug').setDescription('🤗 Ôm ai đó').addUserOption(o=>o.setName('user').setDescription('Người muốn ôm').setRequired(true)),
  new SlashCommandBuilder().setName('pat').setDescription('👋 Vỗ đầu').addUserOption(o=>o.setName('user').setDescription('Người muốn vỗ').setRequired(true)),
  new SlashCommandBuilder().setName('slap').setDescription('💥 Tát').addUserOption(o=>o.setName('user').setDescription('Người muốn tát').setRequired(true)),
  new SlashCommandBuilder().setName('kiss').setDescription('💋 Hôn').addUserOption(o=>o.setName('user').setDescription('Người muốn hôn').setRequired(true)),
  new SlashCommandBuilder().setName('poke').setDescription('👉 Chọc').addUserOption(o=>o.setName('user').setDescription('Người muốn chọc').setRequired(true)),
  new SlashCommandBuilder().setName('bite').setDescription('😈 Cắn').addUserOption(o=>o.setName('user').setDescription('Người muốn cắn').setRequired(true)),
  new SlashCommandBuilder().setName('cuddle').setDescription('🥰 Ôm ấp').addUserOption(o=>o.setName('user').setDescription('Người muốn ôm ấp').setRequired(true)),
  new SlashCommandBuilder().setName('wave').setDescription('👋 Vẫy tay').addUserOption(o=>o.setName('user').setDescription('Người muốn chào').setRequired(false)),
  new SlashCommandBuilder().setName('cry').setDescription('😢 Khóc'),
  new SlashCommandBuilder().setName('dance').setDescription('💃 Nhảy'),
  new SlashCommandBuilder().setName('laugh').setDescription('😂 Cười'),
  new SlashCommandBuilder().setName('blush').setDescription('😳 Đỏ mặt'),
  new SlashCommandBuilder().setName('help').setDescription('📚 Xem tất cả lệnh'),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try { console.log('Đăng ký commands...'); await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c=>c.toJSON()) }); console.log('✅ Xong!'); }
  catch (e) { console.error(e); }
}

client.once('ready', () => {
  console.log(`✅ Bot ${client.user.tag} online!`);
  client.user.setActivity('🎮 /help | Bot Vui Vẻ', { type: 0 });
  registerCommands();
});

// Active number games
const activeNumber = new Map();

// ==================== MAIN HANDLER ====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user } = interaction;

  try {
    // ===== BALANCE =====
    if (commandName === 'balance') {
      const d = getUser(user.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`💰 Ví của ${user.displayName}`).setColor(0xFFD700).setThumbnail(user.displayAvatarURL()).addFields({name:'👛 Ví',value:`**${d.coins.toLocaleString()}** 🪙`,inline:true},{name:'🏦 Ngân hàng',value:`**${d.bank.toLocaleString()}** 🪙`,inline:true},{name:'💎 Tổng',value:`**${(d.coins+d.bank).toLocaleString()}** 🪙`,inline:true}).setFooter({text:`Lv.${d.level} | XP: ${d.xp}/${d.level*100}`})] });
    }

    // ===== DAILY =====
    else if (commandName === 'daily') {
      const d = getUser(user.id); const cd = getCooldown(d, 'daily_cd');
      if (cd > 0) return interaction.reply({ content:`⏳ Còn **${formatTime(cd)}** nữa!`, ephemeral:true });
      const streak = (d.streak || 0) + 1; const base = randomInt(200,500); const bonus = Math.min(streak * 10, 300);
      const amount = base + bonus;
      saveUser(user.id, { coins: d.coins+amount, daily_cd: Date.now()+86400000, streak });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎁 Thưởng hàng ngày!').setColor(0x00FF88).setDescription(`Nhận **${amount}** 🪙 (Base: ${base} + Streak: +${bonus})\n🔥 Streak: **${streak}** ngày liên tiếp!`).setFooter({text:'Quay lại sau 24h!'})] });
    }

    // ===== WORK =====
    else if (commandName === 'work') {
      const d = getUser(user.id); const cd = getCooldown(d, 'work_cd');
      if (cd > 0) return interaction.reply({ content:`⏳ Còn **${formatTime(cd)}** nữa!`, ephemeral:true });
      const jobs = [{j:'Lập trình viên',e:'💻',min:80,max:200},{j:'Giao hàng',e:'🛵',min:40,max:100},{j:'Đầu bếp',e:'👨‍🍳',min:60,max:150},{j:'Ca sĩ',e:'🎤',min:100,max:300},{j:'Streamer',e:'🎮',min:80,max:250},{j:'Bác sĩ',e:'🩺',min:150,max:400},{j:'Luật sư',e:'⚖️',min:200,max:500},{j:'YouTuber',e:'📹',min:50,max:350}];
      const job = jobs[randomInt(0,jobs.length-1)]; const amount = randomInt(job.min,job.max);
      const lvUp = addXP(user.id, 15); const fd = getUser(user.id);
      saveUser(user.id, { coins:fd.coins+amount, work_cd:Date.now()+1800000 });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${job.e} ${job.j}`).setColor(0x3498DB).setDescription(`Kiếm được **${amount}** 🪙!${lvUp?`\n🎉 **LEVEL UP!** → Lv.${fd.level}`:''}`) .setFooter({text:'Làm lại sau 30 phút!'})] });
    }

    // ===== HUNT =====
    else if (commandName === 'hunt') {
      const d = getUser(user.id); const cd = getCooldown(d, 'hunt_cd');
      if (cd > 0) return interaction.reply({ content:`⏳ Còn **${formatTime(cd)}**`, ephemeral:true });
      if (Math.random() < 0.2) { saveUser(user.id,{hunt_cd:Date.now()+1200000}); return interaction.reply({embeds:[new EmbedBuilder().setTitle('🔫 Trượt!').setColor(0xFF4444).setDescription('Không bắt được gì! 😅')]}); }
      const a = pickRandom(HUNT_ANIMALS); const coins = randomInt(a.coins[0],a.coins[1]);
      addXP(user.id,a.xp); const fd=getUser(user.id); saveUser(user.id,{coins:fd.coins+coins,hunted:fd.hunted+1,hunt_cd:Date.now()+1200000});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle(`${a.emoji} Săn Thành Công!`).setColor(a.rare?0xFFD700:0x2ECC71).setDescription(`Săn được **${a.name}** ${a.emoji}${a.rare?'\n✨ **HIẾM!**':''}\n+**${coins}** 🪙`).setFooter({text:'Lại sau 20 phút!'})]});
    }

    // ===== FISH =====
    else if (commandName === 'fish') {
      const d = getUser(user.id); const cd = getCooldown(d,'fish_cd');
      if (cd > 0) return interaction.reply({content:`⏳ Còn **${formatTime(cd)}**`,ephemeral:true});
      if (Math.random() < 0.15) { saveUser(user.id,{fish_cd:Date.now()+900000}); return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎣 Hụt!').setColor(0xFF4444).setDescription('Cá không cắn câu hôm nay...')]}); }
      const f=pickRandom(FISH_LIST); const coins=randomInt(f.coins[0],f.coins[1]);
      addXP(user.id,f.xp); const fd=getUser(user.id); saveUser(user.id,{coins:fd.coins+coins,fished:fd.fished+1,fish_cd:Date.now()+900000});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle(`${f.emoji} Câu Thành Công!`).setColor(f.rare?0xFFD700:0x3498DB).setDescription(`Câu được **${f.name}** ${f.emoji}${f.rare?'\n✨ **HIẾM!**':''}\n+**${coins}** 🪙`).setFooter({text:'Lại sau 15 phút!'})]});
    }

    // ===== DEPOSIT =====
    else if (commandName === 'deposit') {
      const amount = interaction.options.getInteger('amount'); const d=getUser(user.id);
      if (amount<=0) return interaction.reply({content:'❌ Số tiền phải > 0!',ephemeral:true});
      if (d.coins<amount) return interaction.reply({content:`❌ Chỉ có **${d.coins}** 🪙!`,ephemeral:true});
      saveUser(user.id,{coins:d.coins-amount,bank:d.bank+amount});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🏦 Gửi thành công!').setColor(0x00FF88).setDescription(`Gửi **${amount}** 🪙\nVí: **${d.coins-amount}** | NH: **${d.bank+amount}**`)]});
    }

    // ===== WITHDRAW =====
    else if (commandName === 'withdraw') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if (amount<=0) return interaction.reply({content:'❌ Số tiền phải > 0!',ephemeral:true});
      if (d.bank<amount) return interaction.reply({content:`❌ NH chỉ có **${d.bank}** 🪙!`,ephemeral:true});
      saveUser(user.id,{coins:d.coins+amount,bank:d.bank-amount});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🏦 Rút thành công!').setColor(0x00FF88).setDescription(`Rút **${amount}** 🪙\nVí: **${d.coins+amount}** | NH: **${d.bank-amount}**`)]});
    }

    // ===== PAY =====
    else if (commandName === 'pay') {
      const target=interaction.options.getUser('user'); const amount=interaction.options.getInteger('amount');
      if (target.id===user.id) return interaction.reply({content:'❌ Không tự chuyển!',ephemeral:true});
      const s=getUser(user.id); if(s.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const r=getUser(target.id); saveUser(user.id,{coins:s.coins-amount}); saveUser(target.id,{coins:r.coins+amount});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('💸 Chuyển thành công!').setColor(0x00FF88).setDescription(`**${user.displayName}** → **${target.displayName}**: **${amount}** 🪙`)]});
    }

    // ===== ROB =====
    else if (commandName === 'rob') {
      const target=interaction.options.getUser('user'); const d=getUser(user.id);
      const cd=getCooldown(d,'rob_cd'); if(cd>0) return interaction.reply({content:`⏳ Còn **${formatTime(cd)}**`,ephemeral:true});
      if(target.id===user.id) return interaction.reply({content:'❌ Không tự cướp!',ephemeral:true});
      const victim=getUser(target.id); if(victim.coins<100) return interaction.reply({content:'❌ Nạn nhân quá nghèo!',ephemeral:true});
      saveUser(user.id,{rob_cd:Date.now()+3600000});
      if (Math.random()<0.45) { // Thất bại
        const fine=randomInt(50,200); saveUser(user.id,{coins:Math.max(0,d.coins-fine)});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🚔 Bị bắt!').setColor(0xFF4444).setDescription(`Cướp **${target.displayName}** thất bại!\nBị phạt **${fine}** 🪙!`)]});
      }
      const stolen=randomInt(50,Math.min(victim.coins*0.3,500));
      saveUser(user.id,{coins:d.coins+stolen}); saveUser(target.id,{coins:victim.coins-stolen});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🦹 Cướp thành công!').setColor(0x9B59B6).setDescription(`Cướp **${target.displayName}** được **${stolen}** 🪙!\n> *Hãy cẩn thận cảnh sát!*`)]});
    }

    // ===== LEADERBOARD =====
    else if (commandName === 'leaderboard') {
      const db=loadDB(); const sorted=Object.entries(db).sort((a,b)=>(b[1].coins+b[1].bank)-(a[1].coins+a[1].bank)).slice(0,10);
      const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const desc=sorted.length?sorted.map(([uid,d],i)=>`${medals[i]} <@${uid}> — **${(d.coins+d.bank).toLocaleString()}** 🪙`).join('\n'):'Chưa có ai!';
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🏆 Bảng xếp hạng').setColor(0xFFD700).setDescription(desc)]});
    }

    // ===== PROFILE =====
    else if (commandName === 'profile') {
      const d=getUser(user.id); const pct=Math.floor((d.xp/(d.level*100))*10);
      const bar='█'.repeat(pct)+'░'.repeat(10-pct);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle(`📋 ${user.displayName}`).setColor(0x9B59B6).setThumbnail(user.displayAvatarURL()).addFields({name:'💰 Ví',value:`${d.coins.toLocaleString()} 🪙`,inline:true},{name:'🏦 Ngân hàng',value:`${d.bank.toLocaleString()} 🪙`,inline:true},{name:'⭐ Level',value:`${d.level}`,inline:true},{name:'📊 XP',value:`${bar} ${d.xp}/${d.level*100}`},{name:'🐾 Đã săn',value:`${d.hunted||0} lần`,inline:true},{name:'🎣 Đã câu',value:`${d.fished||0} lần`,inline:true},{name:'🔥 Streak',value:`${d.streak||0} ngày`,inline:true})]});
    }

    // ===== TAI XIU =====
    else if (commandName === 'taixiu') {
      const bet=interaction.options.getString('bet'); const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const dice=[randomInt(1,6),randomInt(1,6),randomInt(1,6)]; const sum=dice.reduce((a,b)=>a+b,0);
      const result=sum>=11?'TÀI':'XỈU'; const won=bet===result;
      saveUser(user.id,{coins:Math.max(0,won?d.coins+amount:d.coins-amount)});
      const e=dice.map(d=>['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'][d]).join(' ');
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎲 Tài Xỉu').setColor(won?0x00FF88:0xFF4444).addFields({name:'🎲 Xúc xắc',value:e},{name:'Tổng',value:`**${sum}** → **${result}**`,inline:true},{name:'Cược',value:bet,inline:true},{name:won?'🏆 Thắng!':'💸 Thua!',value:`${won?'+':'-'}**${amount}** 🪙`})]});
    }

    // ===== BAU CUA =====
    else if (commandName === 'baucua') {
      const bet=interaction.options.getString('bet'); const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const dice=[BAU_CUA[randomInt(0,5)],BAU_CUA[randomInt(0,5)],BAU_CUA[randomInt(0,5)]];
      const matches=dice.filter(d=>d.name===bet).length;
      const diceStr=dice.map(d=>d.emoji).join(' ');
      let won=matches>0, gain=0;
      if(matches===1) gain=amount; else if(matches===2) gain=amount*2; else if(matches===3) gain=amount*3;
      saveUser(user.id,{coins:won?d.coins+gain:Math.max(0,d.coins-amount)});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎃 Bầu Cua Tôm Cá').setColor(won?0xFFD700:0xFF4444).addFields({name:'🎲 Kết quả',value:diceStr},{name:'Cược',value:bet,inline:true},{name:'Trùng',value:`${matches} lần`,inline:true},{name:won?'🏆 Thắng!':'💸 Thua!',value:won?`+**${gain}** 🪙`:`-**${amount}** 🪙`})]});
    }

    // ===== COINFLIP =====
    else if (commandName === 'coinflip' || commandName === 'cf') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const choice = commandName==='cf' ? (Math.random()<0.5?'heads':'tails') : interaction.options.getString('choice');
      const result=Math.random()<0.5?'heads':'tails'; const won=commandName==='cf'?true:choice===result;
      const actualWon = commandName==='cf'?(choice===result):won;
      saveUser(user.id,{coins:actualWon?d.coins+amount:Math.max(0,d.coins-amount)});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🪙 Đồng xu').setColor(actualWon?0x00FF88:0xFF4444).setDescription(`Kết quả: **${result==='heads'?'🟡 Heads':'⚪ Tails'}**\n${actualWon?`🏆 Thắng **${amount}** 🪙!`:`💸 Thua **${amount}** 🪙!`}`)]});
    }

    // ===== SLOTS =====
    else if (commandName === 'slots') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const sym=['🍒','🍋','🍊','🍇','⭐','💎','7️⃣']; const w=[30,25,20,15,6,3,1];
      function sp(){const t=w.reduce((a,b)=>a+b,0);let r=randomInt(0,t-1);for(let i=0;i<sym.length;i++){r-=w[i];if(r<0)return sym[i];}return sym[0];}
      const reels=[sp(),sp(),sp()]; let mul=0;
      if(reels[0]===reels[1]&&reels[1]===reels[2]){if(reels[0]==='7️⃣')mul=50;else if(reels[0]==='💎')mul=20;else if(reels[0]==='⭐')mul=10;else mul=5;}
      else if(reels[0]===reels[1]||reels[1]===reels[2]||reels[0]===reels[2])mul=2;else mul=-1;
      const change=mul>0?amount*mul:-amount;
      saveUser(user.id,{coins:Math.max(0,d.coins+change)});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎰 Slots').setColor(mul>0?0xFFD700:0xFF4444).setDescription(`┌────────────┐\n│ ${reels.join(' │ ')} │\n└────────────┘`).addFields({name:mul>0?`🏆 x${mul}!`:'💸 Thua!',value:`${mul>0?'+':''  }**${change}** 🪙`})]});
    }

    // ===== BLACKJACK =====
    else if (commandName === 'blackjack') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      if(activeBlackjack.has(user.id)) return interaction.reply({content:'❌ Bạn đang có game chưa kết thúc! Dùng `/hit` hoặc `/stand`',ephemeral:true});
      const deck=newDeck(); const playerHand=[deck.pop(),deck.pop()]; const dealerHand=[deck.pop(),deck.pop()];
      activeBlackjack.set(user.id,{deck,playerHand,dealerHand,amount,bet:amount});
      const ps=handScore(playerHand);
      if(ps===21) {
        activeBlackjack.delete(user.id); const reward=Math.floor(amount*1.5);
        saveUser(user.id,{coins:d.coins+reward});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 BLACKJACK! 21!').setColor(0xFFD700).setDescription(`Bài bạn: **${handStr(playerHand)}** = **21**\n🏆 BLACKJACK! Thắng **${reward}** 🪙!`)]});
      }
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 Blackjack').setColor(0x3498DB).setDescription(`Bài của bạn: **${handStr(playerHand)}** = **${ps}**\nBài dealer: **${cardStr(dealerHand[0])}** + 🂠\n\nDùng \`/hit\` để rút thêm hoặc \`/stand\` để dừng!`).setFooter({text:`Cược: ${amount} 🪙`})]});
    }

    // ===== HIT =====
    else if (commandName === 'hit') {
      const game=activeBlackjack.get(user.id);
      if(!game) return interaction.reply({content:'❌ Không có game Blackjack! Dùng `/blackjack`',ephemeral:true});
      const card=game.deck.pop(); game.playerHand.push(card); const ps=handScore(game.playerHand);
      if(ps>21) {
        activeBlackjack.delete(user.id); const d=getUser(user.id);
        saveUser(user.id,{coins:Math.max(0,d.coins-game.amount)});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 Bust!').setColor(0xFF4444).setDescription(`Bài: **${handStr(game.playerHand)}** = **${ps}**\n💸 Quá 21! Thua **${game.amount}** 🪙!`)]});
      }
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 Blackjack').setColor(0x3498DB).setDescription(`Bài của bạn: **${handStr(game.playerHand)}** = **${ps}**\nDùng \`/hit\` để rút thêm hoặc \`/stand\` để dừng!`)]});
    }

    // ===== STAND =====
    else if (commandName === 'stand') {
      const game=activeBlackjack.get(user.id);
      if(!game) return interaction.reply({content:'❌ Không có game Blackjack!',ephemeral:true});
      activeBlackjack.delete(user.id);
      while(handScore(game.dealerHand)<17) game.dealerHand.push(game.deck.pop());
      const ps=handScore(game.playerHand); const ds=handScore(game.dealerHand);
      const d=getUser(user.id); let result, coins;
      if(ds>21||ps>ds){result=`🏆 Thắng! +**${game.amount}** 🪙`;coins=d.coins+game.amount;}
      else if(ps===ds){result=`🤝 Hòa! Hoàn lại tiền`;coins=d.coins;}
      else{result=`💸 Thua! -**${game.amount}** 🪙`;coins=Math.max(0,d.coins-game.amount);}
      saveUser(user.id,{coins});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 Kết quả Blackjack').setColor(coins>d.coins?0x00FF88:coins===d.coins?0xFFD700:0xFF4444).addFields({name:'Bài của bạn',value:`${handStr(game.playerHand)} = **${ps}**`},{name:'Bài Dealer',value:`${handStr(game.dealerHand)} = **${ds}**`},{name:'Kết quả',value:result})]});
    }

    // ===== HIGH LOW =====
    else if (commandName === 'highlow') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const deck=newDeck(); const current=deck.pop();
      activeHighLow.set(user.id,{deck,current,amount});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🃏 Cao Thấp').setColor(0x9B59B6).setDescription(`Bài hiện tại: **${cardStr(current)}** (${cardScore(current)} điểm)\n\nBài tiếp theo **Cao hơn** hay **Thấp hơn**?`).addFields({name:'Cách chơi',value:'Bấm **⬆️ Cao** nếu bài sau cao hơn\nBấm **⬇️ Thấp** nếu bài sau thấp hơn'}).setFooter({text:`Cược: ${amount} 🪙`})], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hl_high_${user.id}`).setLabel('⬆️ Cao hơn').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId(`hl_low_${user.id}`).setLabel('⬇️ Thấp hơn').setStyle(ButtonStyle.Danger))] });
    }

    // ===== LOTTERY =====
    else if (commandName === 'lottery') {
      const tickets=Math.min(10,Math.max(1,interaction.options.getInteger('amount'))); const d=getUser(user.id);
      const cd=getCooldown(d,'lottery_cd'); if(cd>0) return interaction.reply({content:`⏳ Còn **${formatTime(cd)}**`,ephemeral:true});
      const cost=tickets*50; if(d.coins<cost) return interaction.reply({content:`❌ Cần **${cost}** 🪙 cho ${tickets} vé!`,ephemeral:true});
      saveUser(user.id,{coins:d.coins-cost,lottery_cd:Date.now()+21600000});
      const winning=[randomInt(1,50),randomInt(1,50),randomInt(1,50)];
      let matches=0;
      for(let i=0;i<tickets;i++){const t=[randomInt(1,50),randomInt(1,50),randomInt(1,50)];if(t[0]===winning[0]&&t[1]===winning[1]&&t[2]===winning[2])matches++;}
      let prize=0, msg='';
      if(matches>0){prize=matches*5000;msg=`🎉 **${matches}** vé trúng! +**${prize}** 🪙!`;const fd=getUser(user.id);saveUser(user.id,{coins:fd.coins+prize});}
      else msg='😔 Không trúng lần này...';
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎟️ Xổ Số').setColor(matches>0?0xFFD700:0xFF4444).setDescription(`Số trúng: **${winning.join(' - ')}**\n${msg}\nMua **${tickets}** vé × 50 🪙`).setFooter({text:'Mua lại sau 6 giờ!'})]});
    }

    // ===== RUSSIAN ROULETTE =====
    else if (commandName === 'russianroulette') {
      const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      const chambers=6; const bullet=randomInt(1,chambers); const fired=randomInt(1,chambers);
      if(fired===bullet){
        const lose=d.coins; saveUser(user.id,{coins:0});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🔫 BANG! 💀').setColor(0xFF0000).setDescription(`Bạn đã chết! 💀\nMất tất cả **${lose.toLocaleString()}** 🪙!\n\n*Bắt đầu lại từ đầu...*`)]});
      }
      const reward=Math.floor(amount*2.5); saveUser(user.id,{coins:d.coins+reward});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🔫 *Click* Sống sót!').setColor(0x00FF88).setDescription(`Phòng ${fired}/${chambers} — Không có đạn!\n🏆 Thắng **${reward}** 🪙! (x2.5)`)]});
    }

    // ===== HORSE RACE =====
    else if (commandName === 'race') {
      const pick=interaction.options.getString('horse'); const amount=interaction.options.getInteger('amount'); const d=getUser(user.id);
      if(amount<=0||d.coins<amount) return interaction.reply({content:`❌ Không đủ tiền!`,ephemeral:true});
      await interaction.deferReply();
      const horses=['🐎','🐎','🐎','🐎']; const pos=[0,0,0,0]; const odds=[2,3,4,5];
      let raceStr=''; let winner=-1;
      while(winner===-1){for(let i=0;i<4;i++){if(Math.random()<0.3)pos[i]++;if(pos[i]>=10)winner=i;}};
      const track=pos.map((p,i)=>`Ngựa ${i+1}: ${'▓'.repeat(p)}${'░'.repeat(10-Math.min(p,10))} ${horses[i]}`).join('\n');
      const won=(winner+1)===parseInt(pick); const mult=odds[winner];
      if(won){saveUser(user.id,{coins:d.coins+(amount*mult)});}else{saveUser(user.id,{coins:Math.max(0,d.coins-amount)});}
      return interaction.editReply({embeds:[new EmbedBuilder().setTitle('🏁 Đua Ngựa').setColor(won?0xFFD700:0xFF4444).setDescription(`\`\`\`\n${track}\n\`\`\`\n🏆 Ngựa **${winner+1}** thắng!\n${won?`Bạn đặt đúng! +**${amount*mult}** 🪙 (x${mult})`:`Ngựa ${pick} thua! -**${amount}** 🪙`}`)]});
    }

    // ===== WORDLE =====
    else if (commandName === 'wordle') {
      if(activeWordle.has(interaction.channelId)) return interaction.reply({content:'⚠️ Đang có game! Dùng `/guess`',ephemeral:true});
      const word=WORDLE_WORDS[randomInt(0,WORDLE_WORDS.length-1)];
      activeWordle.set(interaction.channelId,{word,guesses:[],userId:user.id});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🟩 WORDLE').setColor(0x6AAA64).setDescription(`**${user.displayName}** bắt đầu!\nĐoán từ 5 chữ cái với \`/guess\`\n\n${wordleDisplay([],word)}`).addFields({name:'Ký hiệu',value:'🟩 Đúng vị trí | 🟨 Có nhưng sai chỗ | ⬛ Không có'})]});
    }

    // ===== GUESS (WORDLE) =====
    else if (commandName === 'guess') {
      const game=activeWordle.get(interaction.channelId);
      if(!game) return interaction.reply({content:'❌ Không có game! Dùng `/wordle`',ephemeral:true});
      const g=interaction.options.getString('word').toUpperCase();
      if(g.length!==5||!/^[A-Z]+$/.test(g)) return interaction.reply({content:'❌ Phải 5 chữ cái tiếng Anh!',ephemeral:true});
      game.guesses.push(g); const display=wordleDisplay(game.guesses,game.word);
      if(g===game.word){activeWordle.delete(interaction.channelId);const r=(7-game.guesses.length)*50;const d=getUser(user.id);saveUser(user.id,{coins:d.coins+r});return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎉 WORDLE Thắng!').setColor(0x00FF88).setDescription(`Từ đúng: **${game.word}**\nThưởng **${r}** 🪙!\n\n${display}`)]}); }
      if(game.guesses.length>=6){activeWordle.delete(interaction.channelId);return interaction.reply({embeds:[new EmbedBuilder().setTitle('😞 Game Over!').setColor(0xFF4444).setDescription(`Đáp án: **${game.word}**\n\n${display}`)]}); }
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🟩 WORDLE').setColor(0x6AAA64).setDescription(`${display}\nCòn **${6-game.guesses.length}** lần`)]});
    }

    // ===== TRIVIA =====
    else if (commandName === 'trivia') {
      if(activeTrivia.has(interaction.channelId)) return interaction.reply({content:'⚠️ Đang có câu hỏi! Dùng `/answer`',ephemeral:true});
      const q=TRIVIA[randomInt(0,TRIVIA.length-1)];
      activeTrivia.set(interaction.channelId,{...q,userId:user.id,expires:Date.now()+30000});
      setTimeout(()=>activeTrivia.delete(interaction.channelId),30000);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('❓ Đố Vui').setColor(0x3498DB).setDescription(`**${q.q}**`).addFields({name:'💡 Gợi ý',value:q.hint}).setFooter({text:'Trả lời trong 30 giây với /answer!'})]});
    }

    // ===== ANSWER (TRIVIA) =====
    else if (commandName === 'answer') {
      const game=activeTrivia.get(interaction.channelId);
      if(!game) return interaction.reply({content:'❌ Không có câu hỏi! Dùng `/trivia`',ephemeral:true});
      const ans=interaction.options.getString('answer').toLowerCase().trim();
      if(ans===game.a.toLowerCase()){
        activeTrivia.delete(interaction.channelId); const reward=randomInt(100,300); const d=getUser(user.id);
        saveUser(user.id,{coins:d.coins+reward}); addXP(user.id,20);
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('✅ Đúng rồi!').setColor(0x00FF88).setDescription(`Câu trả lời đúng: **${game.a}**\n${user} nhận **${reward}** 🪙!`)]});
      }
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('❌ Sai rồi!').setColor(0xFF4444).setDescription(`**${ans}** không đúng! Thử lại với \`/answer\``)]});
    }

    // ===== HANGMAN =====
    else if (commandName === 'hangman') {
      if(activeHangman.has(interaction.channelId)) return interaction.reply({content:'⚠️ Đang có game! Dùng `/letter`',ephemeral:true});
      const w=HANGMAN_WORDS[randomInt(0,HANGMAN_WORDS.length-1)];
      activeHangman.set(interaction.channelId,{word:w.word,hint:w.hint,guessed:[],wrong:0,userId:user.id});
      const display=w.word.split('').map(()=>'_').join(' ');
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎯 Treo Cổ (Hangman)').setColor(0xE67E22).setDescription(`${HANGMAN_STAGES[0]}\n**${display}**\n💡 Gợi ý: ${w.hint}`).setFooter({text:'Đoán từng chữ cái với /letter!'})]});
    }

    // ===== LETTER (HANGMAN) =====
    else if (commandName === 'letter') {
      const game=activeHangman.get(interaction.channelId);
      if(!game) return interaction.reply({content:'❌ Không có game! Dùng `/hangman`',ephemeral:true});
      const l=interaction.options.getString('letter').toUpperCase()[0];
      if(!/[A-Z]/.test(l)) return interaction.reply({content:'❌ Chỉ nhập 1 chữ cái!',ephemeral:true});
      if(game.guessed.includes(l)) return interaction.reply({content:`❌ Đã đoán **${l}** rồi!`,ephemeral:true});
      game.guessed.push(l);
      if(!game.word.includes(l)) game.wrong++;
      const display=game.word.split('').map(c=>game.guessed.includes(c)?c:'_').join(' ');
      const won=!display.includes('_'); const lost=game.wrong>=6;
      if(won){
        activeHangman.delete(interaction.channelId); const reward=500-(game.wrong*50);
        const d=getUser(user.id); saveUser(user.id,{coins:d.coins+reward});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎉 Thắng Hangman!').setColor(0x00FF88).setDescription(`Từ đúng: **${game.word}**\nThưởng **${reward}** 🪙 (${game.wrong} lần sai)`)]});
      }
      if(lost){
        activeHangman.delete(interaction.channelId);
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('💀 Game Over!').setColor(0xFF4444).setDescription(`${HANGMAN_STAGES[6]}\nĐáp án: **${game.word}**`)]});
      }
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎯 Hangman').setColor(0xE67E22).setDescription(`${HANGMAN_STAGES[game.wrong]}\n**${display}**\n\nĐã đoán: ${game.guessed.join(', ')}\n❌ Sai: **${game.wrong}/6**`)]});
    }

    // ===== NUMBER GAME =====
    else if (commandName === 'startnumber') {
      const secret=randomInt(1,100);
      activeNumber.set(interaction.channelId,{secret,tries:0,userId:user.id});
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🔢 Đoán Số').setColor(0x1ABC9C).setDescription('Mình đang nghĩ một số từ **1 đến 100**!\nDùng `/number <số>` để đoán.\nThưởng nhiều hơn nếu đoán ít lần!')]});
    }

    else if (commandName === 'number') {
      const game=activeNumber.get(interaction.channelId);
      if(!game) return interaction.reply({content:'❌ Không có game! Dùng `/startnumber`',ephemeral:true});
      const g=interaction.options.getInteger('guess'); game.tries++;
      if(g===game.secret){
        activeNumber.delete(interaction.channelId); const reward=Math.max(50,500-game.tries*40);
        const d=getUser(user.id); saveUser(user.id,{coins:d.coins+reward});
        return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎉 Đúng rồi!').setColor(0x00FF88).setDescription(`Số đúng là **${game.secret}**!\nĐoán trong **${game.tries}** lần → Thưởng **${reward}** 🪙`)]});
      }
      const hint=g<game.secret?'📈 Số cần tìm **lớn hơn**!':'📉 Số cần tìm **nhỏ hơn**!';
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🔢 Đoán Số').setColor(0xE67E22).setDescription(`**${g}** — ${hint}\nLần đoán: **${game.tries}**`)]});
    }

    // ===== RPS =====
    else if (commandName === 'rps') {
      const c=interaction.options.getString('choice'); const choices=['rock','paper','scissors'];
      const bc=choices[randomInt(0,2)]; const em={rock:'✊',paper:'✋',scissors:'✂️'}; const nm={rock:'Búa',paper:'Bao',scissors:'Kéo'};
      let r; if(c===bc)r='🤝 Hòa!'; else if((c==='rock'&&bc==='scissors')||(c==='paper'&&bc==='rock')||(c==='scissors'&&bc==='paper'))r='🏆 Bạn thắng!'; else r='💸 Bot thắng!';
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('✊ Kéo Búa Bao').setColor(r.includes('Bạn')?0x00FF88:r.includes('Hòa')?0xFFD700:0xFF4444).setDescription(`Bạn: ${em[c]} ${nm[c]}\nBot: ${em[bc]} ${nm[bc]}\n\n**${r}**`)]});
    }

    // ===== 8BALL =====
    else if (commandName === '8ball') {
      const q=interaction.options.getString('question');
      const answers=['✅ Chắc chắn!','✅ Đúng vậy!','✅ Có thể!','✅ Triển vọng tốt!','🔮 Hỏi lại sau!','🔮 Chưa chắc...','🔮 Tập trung hỏi lại!','❌ Đừng mong đợi!','❌ KHÔNG!','❌ Rất nghi ngờ!'];
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎱 Quả Cầu Ma Thuật').setColor(0x2C2F33).addFields({name:'❓',value:q},{name:'🎱',value:answers[randomInt(0,answers.length-1)]})]});
    }

    // ===== ROLL =====
    else if (commandName === 'roll') {
      const sides=interaction.options.getInteger('sides')||6; const result=randomInt(1,sides);
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('🎲 Tung Xúc Xắc').setColor(0x9B59B6).setDescription(`Xúc xắc **${sides}** mặt → **${result}**!`)]});
    }

    // ===== GIF COMMANDS =====
    else if (['hug','pat','slap','kiss','poke','bite','cuddle','wave','cry','dance','laugh','blush'].includes(commandName)) {
      const target=interaction.options.getUser('user');
      await interaction.deferReply();
      const gif=await fetchGif(commandName);
      const configs = {
        hug:  {title:'🤗 Ôm!',      color:0xFF69B4, msg:(u,t)=>`${u} đã ôm ${t}! 🤗\n*Ấm áp quá~*`},
        pat:  {title:'👋 Vỗ đầu!',  color:0xFFD700, msg:(u,t)=>`${u} vỗ đầu ${t}! 👋\n*Ngoan lắm~*`},
        slap: {title:'💥 Tát!',      color:0xFF4444, msg:(u,t)=>`${u} tát ${t}! 💥\n*BPHWAAAPPP!*`},
        kiss: {title:'💋 Hôn!',      color:0xFF1493, msg:(u,t)=>`${u} hôn ${t}! 💋\n*Ôi trời~*`},
        poke: {title:'👉 Chọc!',     color:0xFFA500, msg:(u,t)=>`${u} chọc ${t}! 👉\n*Này này này~*`},
        bite: {title:'😈 Cắn!',      color:0x8B0000, msg:(u,t)=>`${u} cắn ${t}! 😈\n*Ăn thịt!*`},
        cuddle:{title:'🥰 Ôm ấp!',  color:0xFFB6C1, msg:(u,t)=>`${u} ôm ấp ${t}! 🥰\n*Dễ thương~*`},
        wave: {title:'👋 Chào!',     color:0x00BFFF, msg:(u,t)=>t?`${u} chào ${t}! 👋`:`${u} chào mọi người! 👋`},
        cry:  {title:'😢 Khóc!',     color:0x4169E1, msg:(u)=>`${u} đang khóc... 😢`},
        dance:{title:'💃 Nhảy!',     color:0x9400D3, msg:(u)=>`${u} đang nhảy! 💃`},
        laugh:{title:'😂 Cười!',     color:0xFFFF00, msg:(u)=>`${u} cười lăn! 😂`},
        blush:{title:'😳 Đỏ mặt!',  color:0xFF6B6B, msg:(u)=>`${u} đang đỏ mặt! 😳`},
      };
      const cfg=configs[commandName];
      const embed=new EmbedBuilder().setTitle(cfg.title).setColor(cfg.color).setDescription(cfg.msg(user,target));
      if(gif) embed.setImage(gif);
      return interaction.editReply({embeds:[embed]});
    }

    // ===== HELP =====
    else if (commandName === 'help') {
      return interaction.reply({embeds:[new EmbedBuilder().setTitle('📚 Bot Vui Vẻ').setColor(0x5865F2).setDescription('Tất cả lệnh của bot 🎮').addFields(
        {name:'💰 Kinh tế',value:'`/balance` `/daily` `/work` `/hunt` `/fish`\n`/deposit` `/withdraw` `/pay` `/rob`\n`/leaderboard` `/profile`'},
        {name:'🎲 Cờ bạc',value:'`/taixiu` `/baucua` `/coinflip` `/cf`\n`/slots` `/blackjack` `/highlow`\n`/lottery` `/russianroulette` `/race`'},
        {name:'🧠 Trí tuệ',value:'`/wordle` `/guess` `/trivia` `/answer`\n`/hangman` `/letter` `/startnumber` `/number`\n`/rps` `/8ball` `/roll`'},
        {name:'🎉 Tương tác GIF',value:'`/hug` `/pat` `/slap` `/kiss` `/poke`\n`/bite` `/cuddle` `/wave` `/cry`\n`/dance` `/laugh` `/blush`'},
      ).setFooter({text:'💾 Dữ liệu lưu vĩnh viễn trong data.json'})]});
    }

  } catch(err) {
    console.error('Lỗi:',err);
    try { if(!interaction.replied) interaction.reply({content:'❌ Lỗi! Thử lại sau.',ephemeral:true}); } catch {}
  }
});

// ===== HIGH LOW BUTTON HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const [type, choice, userId] = interaction.customId.split('_');
  if (type !== 'hl') return;
  if (interaction.user.id !== userId) return interaction.reply({content:'❌ Không phải game của bạn!',ephemeral:true});
  const game = activeHighLow.get(userId);
  if (!game) return interaction.reply({content:'❌ Game đã hết hạn!',ephemeral:true});
  activeHighLow.delete(userId);
  const next = game.deck.pop();
  const currScore = cardScore(game.current), nextScore = cardScore(next);
  const actuallyHigher = nextScore > currScore, actuallyLower = nextScore < currScore;
  const won = (choice === 'high' && actuallyHigher) || (choice === 'low' && actuallyLower);
  const d = getUser(userId);
  saveUser(userId, {coins: won ? d.coins + game.amount : Math.max(0, d.coins - game.amount)});
  return interaction.update({embeds:[new EmbedBuilder().setTitle('🃏 Kết quả Cao Thấp').setColor(won?0x00FF88:0xFF4444).addFields({name:'Bài cũ',value:`${cardStr(game.current)} (${currScore}đ)`,inline:true},{name:'Bài mới',value:`${cardStr(next)} (${nextScore}đ)`,inline:true},{name:won?'🏆 Đúng!':'💸 Sai!',value:won?`+**${game.amount}** 🪙`:`-**${game.amount}** 🪙`})], components:[]});
});

client.login(process.env.DISCORD_TOKEN);
