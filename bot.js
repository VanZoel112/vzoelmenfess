const { Telegraf } = require('telegraf');
const { config, validateConfig } = require('./config');

validateConfig();

const BOT_TOKEN = config.botToken;
const CHANNEL_ID = config.channelId;
const PHOTO_BOY = config.photoBoyId;
const PHOTO_GIRL = config.photoGirlId;
const SEND_DELAY_MS = Number(config.sendDelayMs || 0);
const FORCE_SUB_CHANNELS = Array.isArray(config.forceSubChannels) ? config.forceSubChannels : [];

const pendingMenfess = [];
let isSending = false;

const bot = new Telegraf(BOT_TOKEN);
const allowedMemberStatuses = new Set(['creator', 'administrator', 'member']);

function formatForceSubEntry(entry) {
  if (!entry) {
    return '';
  }

  if (entry.label) {
    return entry.label;
  }

  if (entry.buttonText) {
    return entry.buttonText;
  }

  if (entry.link) {
    return entry.link;
  }

  if (entry.id) {
    return entry.id;
  }

  return '';
}

function buildForceSubReminder(missingEntries) {
  if (missingEntries.length === 0) {
    return 'Sebelum kirim menfess, wajib join dulu ke channel yang sudah ditentukan.';
  }

  if (missingEntries.length === 1) {
    const reference = formatForceSubEntry(missingEntries[0]);
    const targetText = reference || 'channel yang wajib kamu ikuti';
    return `Sebelum kirim menfess, wajib join dulu ke ${targetText}. Setelah bergabung, kirim lagi ya.`;
  }

  const listText = missingEntries
    .map((entry) => formatForceSubEntry(entry) || 'Channel tanpa referensi')
    .map((text) => `- ${text}`)
    .join('\n');

  return `Sebelum kirim menfess, pastikan kamu sudah join ke semua channel/grup berikut:\n${listText}\n\nSetelah bergabung semua, kirim lagi ya.`;
}

function buildEntryUrl(entry) {
  if (!entry) {
    return null;
  }

  if (entry.link) {
    return entry.link;
  }

  if (entry.id && typeof entry.id === 'string' && entry.id.startsWith('@')) {
    return `https://t.me/${entry.id.slice(1)}`;
  }

  return null;
}

function buildEntryButtonText(entry) {
  if (!entry) {
    return 'Join channel';
  }

  if (entry.buttonText) {
    return entry.buttonText;
  }

  if (entry.label) {
    return entry.label;
  }

  if (entry.id && entry.id.startsWith('@')) {
    return entry.id;
  }

  if (entry.link) {
    return entry.link.replace(/^https?:\/\/(www\.)?/i, '');
  }

  return 'Join channel';
}

function chunkButtons(buttons, chunkSize) {
  const rows = [];

  for (let index = 0; index < buttons.length; index += chunkSize) {
    rows.push(buttons.slice(index, index + chunkSize));
  }

  return rows;
}

function buildForceSubButtons(entries) {
  const buttons = entries
    .map((entry) => {
      const url = buildEntryUrl(entry);

      if (!url) {
        return null;
      }

      return {
        text: buildEntryButtonText(entry),
        url
      };
    })
    .filter(Boolean);

  if (buttons.length === 0) {
    return null;
  }

  return chunkButtons(buttons, 2);
}

async function sendForceSubReminder(ctx, missingEntries) {
  const reminder = buildForceSubReminder(missingEntries);
  const inlineKeyboard = buildForceSubButtons(missingEntries);

  if (inlineKeyboard) {
    await ctx.reply(reminder, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
    return;
  }

  await ctx.reply(reminder);
}

async function ensureSubscribed(ctx) {
  if (FORCE_SUB_CHANNELS.length === 0) {
    return true;
  }

  const missing = [];

  for (const entry of FORCE_SUB_CHANNELS) {
    const targetId = entry.id;

    try {
      const member = await ctx.telegram.getChatMember(targetId, ctx.from.id);

      if (!allowedMemberStatuses.has(member.status)) {
        missing.push(entry);
      }
    } catch (error) {
      if (error.response && error.response.error_code === 400) {
        missing.push(entry);
        continue;
      }

      console.error('Gagal memeriksa keanggotaan channel:', error);
      await ctx.reply('Maaf, bot lagi nggak bisa cek keanggotaan kamu. Coba lagi nanti ya.');
      return false;
    }
  }

  if (missing.length > 0) {
    await sendForceSubReminder(ctx, missing);
    return false;
  }

  return true;
}

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
        caption
      });
    } catch (error) {
      console.error('Gagal mengirim menfess ke channel:', error);
    }

    if (pendingMenfess.length > 0 && SEND_DELAY_MS > 0) {
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

function buildJoinLine() {
  if (FORCE_SUB_CHANNELS.length === 0) {
    return '';
  }

  if (FORCE_SUB_CHANNELS.length === 1) {
    const reference = formatForceSubEntry(FORCE_SUB_CHANNELS[0]);
    return reference ? `- Wajib join terlebih dahulu: ${reference}` : '';
  }

  const references = FORCE_SUB_CHANNELS
    .map((entry) => formatForceSubEntry(entry))
    .filter(Boolean)
    .map((text) => `  • ${text}`)
    .join('\n');

  if (!references) {
    return '';
  }

  return ['- Wajib join ke semua channel/grup berikut:', references].join('\n');
}

bot.start(async (ctx) => {
  await ctx.reply('Halo! Black Pearl Bot siap menerima menfess. Ketik /help buat lihat panduan lengkapnya.');
});

bot.help(async (ctx) => {
  const joinLine = buildJoinLine();

  const helpMessage = [
    'Panduan kirim menfess:',
    joinLine,
    '- Pastikan kamu sudah punya username Telegram.',
    '- Sertakan salah satu hashtag #boy atau #girl di pesan menfess.',
    '- Setelah terkirim, bot bakal mengirimkan menfess kamu ke channel secara bergantian.',
    '',
    'Contoh: #boy need fwb @usernamekamu!'
  ]
    .filter(Boolean)
    .join('\n');

  await ctx.reply(helpMessage);
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  const fromUser = ctx.from;

  const subscribed = await ensureSubscribed(ctx);

  if (!subscribed) {
    return;
  }

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

  ctx.reply(`Sip! Menfess kamu berhasil masuk antrean ${hashtag} dan akan otomatis dikirim ke channel. lihat dichannel ya dan tunggu kalo belum kekirim.... auto menfess by @VZLfxs`);
});

bot.launch();
console.log('Bot menfess dengan fitur antrean otomatis berhasil dijalankan!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
