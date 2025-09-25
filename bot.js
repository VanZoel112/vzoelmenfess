const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PHOTO_BOY = process.env.PHOTO_BOY_ID;
const PHOTO_GIRL = process.env.PHOTO_GIRL_ID;

if (!BOT_TOKEN) {
  throw new Error('Environment variable BOT_TOKEN harus diisi.');
}

if (!CHANNEL_ID) {
  throw new Error('Environment variable CHANNEL_ID harus diisi.');
}

if (!PHOTO_BOY || !PHOTO_GIRL) {
  throw new Error('Environment variable PHOTO_BOY_ID dan PHOTO_GIRL_ID harus diisi.');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Black Pearl Assistant siap mengirim pesan. Pastikan kamu punya username dan pake hashtag #boy atau #girl ya!..');
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

  try {
    const caption = `${userMessage}\n\nSender: @${fromUser.username}`;

    await ctx.telegram.sendPhoto(CHANNEL_ID, photoToSend, {
      caption,
    });

    ctx.reply('Sip! Menfess kamu berhasil dikirim!');
  } catch (error) {
    console.error('Error pas ngirim menfess:', error);
    ctx.reply('Aduh, maaf, ada kesalahan teknis pas mau ngirim menfess kamu. Coba lagi nanti ya.');
  }
});

bot.launch();
console.log('Bot menfess dengan fitur canggih berhasil dijalankan!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
