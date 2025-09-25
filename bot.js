const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PHOTO_BOY = process.env.PHOTO_BOY_ID;
const PHOTO_GIRL = process.env.PHOTO_GIRL_ID;
const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS || 2000);

if (!BOT_TOKEN) {
  throw new Error('Environment variable BOT_TOKEN harus diisi.');
}

if (!CHANNEL_ID) {
  throw new Error('Environment variable CHANNEL_ID harus diisi.');
}

if (!PHOTO_BOY || !PHOTO_GIRL) {
  throw new Error('Environment variable PHOTO_BOY_ID dan PHOTO_GIRL_ID harus diisi.');
}

const pendingMenfess = [];
let isSending = false;

const bot = new Telegraf(BOT_TOKEN);

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processQueue() {
  if (isSending) {
    return;
  }

  isSending = true;

  while (pendingMenfess.length > 0) {
    const { photoId, caption } = pendingMenfess.shift();

    try {
      await bot.telegram.sendPhoto(CHANNEL_ID, photoId, {
        caption,
      });
    } catch (error) {
      console.error('Gagal mengirim menfess ke channel:', error);
    }

    if (pendingMenfess.length > 0) {
      await wait(SEND_DELAY_MS);
    }
  }

  isSending = false;
}

function enqueueMenfess(photoId, caption) {
  pendingMenfess.push({ photoId, caption });
  processQueue().catch((error) => {
    console.error('Kesalahan saat memproses antrean menfess:', error);
  });
}

bot.start((ctx) => {
  ctx.reply('Halo! Black Pearl Bot siap menerima menfess. Pastikan kamu punya username dan pake hashtag #boy atau #girl ya.. Auto menfess by Vzoel');
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  const fromUser = ctx.from;

  if (!fromUser.username) {
    return ctx.reply('Maaf, kamu harus punya username Telegram dulu buat kirim menfess.');
  }

  let photoToSend = null;
  let hashtag = '';

  if (userMessage.includes('#boy')) {
    photoToSend = PHOTO_BOY;
    hashtag = '#boy';
  } else if (userMessage.includes('#girl')) {
    photoToSend = PHOTO_GIRL;
    hashtag = '#girl';
  }

  if (!photoToSend) {
    return ctx.reply('Menfess kamu harus mengandung salah satu hashtag: #boy atau #girl.');
  }

  const caption = `${userMessage}\n\nSender: @${fromUser.username}`;

  enqueueMenfess(photoToSend, caption);

  ctx.reply(`Sip! Menfess kamu berhasil masuk antrean ${hashtag} dan akan otomatis dikirim ke channel.`);
});

bot.launch();
console.log('Bot menfess dengan fitur antrean otomatis berhasil dijalankan.. cek pesan kamu dichannel!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
