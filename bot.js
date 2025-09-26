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
// More comprehensive member status check - including restricted users who can still be "members"
const allowedMemberStatuses = new Set(['creator', 'administrator', 'member', 'restricted']);

// Middleware: Only allow private chats
bot.use(async (ctx, next) => {
  // Only process private messages, ignore group/channel messages
  if (ctx.chat?.type !== 'private') {
    console.log(`🚫 Ignoring message from ${ctx.chat?.type} chat (${ctx.chat?.id})`);
    return; // Don't respond to group/channel messages
  }

  await next(); // Continue to next middleware/handler
});

// Robust function to check if user is subscribed to a channel
async function isUserSubscribed(telegram, channelId, userId) {
  try {
    console.log(`🔍 Checking user ${userId} in channel ${channelId}`);

    const chatMember = await telegram.getChatMember(channelId, userId);
    console.log(`📋 Raw API response:`, JSON.stringify(chatMember, null, 2));

    const status = chatMember.status;
    console.log(`👤 Member status: ${status}`);

    // Check if user is subscribed (not kicked or left)
    const isSubscribed = !['left', 'kicked'].includes(status);
    console.log(`✅ Is subscribed: ${isSubscribed} (status: ${status})`);

    return isSubscribed;

  } catch (error) {
    console.log(`🚫 Error checking subscription:`, error.response?.error_code, error.response?.description);

    // If user is not found or bot has no permission, consider as not subscribed
    if (error.response) {
      const errorCode = error.response.error_code;
      const description = error.response.description || '';

      // Common error codes:
      // 400: Bad Request - user not found, invalid chat id, etc.
      // 403: Forbidden - bot doesn't have permission
      if (errorCode === 400 && description.includes('user not found')) {
        console.log(`❌ User not found in channel - considering as not subscribed`);
        return false;
      }

      if (errorCode === 400 && description.includes('chat not found')) {
        console.log(`❌ Channel not found - considering as not subscribed`);
        return false;
      }

      if (errorCode === 403) {
        console.log(`❌ Bot forbidden to check this channel - considering as not subscribed`);
        return false;
      }
    }

    // For any other error, assume not subscribed to be safe
    console.log(`❌ Unknown error - considering as not subscribed for safety`);
    return false;
  }
}

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

function buildForceSubButtons(entries, includeRetry = true) {
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

  // Group join buttons in rows of 2
  const joinButtonRows = chunkButtons(buttons, 2);

  // Add retry button if requested
  if (includeRetry) {
    const retryButton = [{
      text: '🔄 Cek Lagi',
      callback_data: 'retry_fsub_check'
    }];

    joinButtonRows.push(retryButton);
  }

  return joinButtonRows;
}

async function sendForceSubReminder(ctx, missingEntries) {
  const reminder = buildForceSubReminder(missingEntries);
  const inlineKeyboard = buildForceSubButtons(missingEntries);

  // Enhanced message with clearer instructions
  const enhancedMessage = `${reminder}

📌 **Langkah-langkah:**
1️⃣ Klik tombol channel/grup di bawah untuk join
2️⃣ Pastikan sudah join semua channel yang diperlukan
3️⃣ Klik tombol **🔄 Cek Lagi** untuk verifikasi
4️⃣ Setelah terverifikasi, kirim ulang menfess Anda

⚠️ Pesan menfess Anda akan otomatis diproses setelah bergabung di semua channel.`;

  if (inlineKeyboard) {
    await ctx.reply(enhancedMessage, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      },
      parse_mode: 'Markdown'
    });
    return;
  }

  await ctx.reply(reminder);
}

async function ensureSubscribed(ctx) {
  if (FORCE_SUB_CHANNELS.length === 0) {
    return true;
  }

  console.log(`🔍 [ensureSubscribed] Checking subscription for user ${ctx.from.id} (@${ctx.from.username})`);

  const missing = [];

  for (const entry of FORCE_SUB_CHANNELS) {
    const targetId = entry.id;

    console.log(`📋 [ensureSubscribed] Checking channel: ${entry.label} (ID: ${targetId})`);

    const isSubscribed = await isUserSubscribed(ctx.telegram, targetId, ctx.from.id);

    if (!isSubscribed) {
      console.log(`❌ [ensureSubscribed] User not subscribed to ${entry.label}`);
      missing.push(entry);
    } else {
      console.log(`✅ [ensureSubscribed] User subscribed to ${entry.label}`);
    }
  }

  console.log(`📊 [ensureSubscribed] Final missing channels: ${missing.length}`, missing.map(e => e.label));

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
      console.log(`📤 Sending menfess to channel ${CHANNEL_ID}`);
      console.log(`📷 Photo ID: ${photoId}`);
      console.log(`📝 Caption: ${caption}`);

      await bot.telegram.sendPhoto(CHANNEL_ID, photoId, {
        caption
      });

      console.log(`✅ Successfully sent menfess to channel`);
    } catch (error) {
      console.error('❌ Gagal mengirim menfess ke channel:', error);
    }

    if (pendingMenfess.length > 0 && SEND_DELAY_MS > 0) {
      console.log(`⏳ Waiting ${SEND_DELAY_MS}ms before next menfess...`);
      await wait(SEND_DELAY_MS);
    }
  }

  console.log(`📋 Queue processing complete. isSending = false`);
  isSending = false;
}

function enqueueMenfess(photoId, caption) {
  console.log(`📥 Adding menfess to queue. Queue length: ${pendingMenfess.length + 1}`);
  pendingMenfess.push({ photoId, caption });
  console.log(`🚀 Starting queue processing...`);
  processQueue().catch((error) => {
    console.error('❌ Kesalahan saat memproses antrean menfess:', error);
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
  await ctx.reply(`Halo! Black Pearl Bot siap menerima menfess.

🔒 **Bot ini hanya bekerja di private chat untuk menjaga privasi kamu.**

Ketik /help buat lihat panduan lengkapnya.`);
});

bot.help(async (ctx) => {
  const joinLine = buildJoinLine();

  const helpMessage = [
    '📖 **Panduan Kirim Menfess:**',
    '',
    '🔒 **PENTING:** Bot ini hanya bekerja di private chat!',
    '⚠️ Jangan kirim perintah di grup atau channel.',
    '',
    joinLine,
    '- Pastikan kamu sudah punya username Telegram.',
    '- Sertakan salah satu hashtag #boy atau #girl di pesan menfess.',
    '- Setelah terkirim, bot bakal mengirimkan menfess kamu ke channel secara bergantian.',
    '',
    '📝 **Contoh:** #boy need fwb @usernamekamu!',
    '',
    '💡 **Tips:** Kirim menfess hanya di chat private dengan bot ini untuk menjaga privasi kamu.'
  ]
    .filter(Boolean)
    .join('\n');

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
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

// Function untuk check subscription dari callback context
async function checkSubscriptionFromCallback(ctx) {
  if (FORCE_SUB_CHANNELS.length === 0) {
    return true;
  }

  const missing = [];

  console.log(`🔍 [Callback] Checking subscription for user ${ctx.from.id} (@${ctx.from.username})`);

  for (const entry of FORCE_SUB_CHANNELS) {
    const targetId = entry.id;

    console.log(`📋 [Callback] Checking channel: ${entry.label} (ID: ${targetId})`);

    const isSubscribed = await isUserSubscribed(ctx.telegram, targetId, ctx.from.id);

    if (!isSubscribed) {
      console.log(`❌ [Callback] User not subscribed to ${entry.label}`);
      missing.push(entry);
    } else {
      console.log(`✅ [Callback] User subscribed to ${entry.label}`);
    }
  }

  console.log(`📊 Final missing channels: ${missing.length}`, missing.map(e => e.label));

  if (missing.length > 0) {
    // Update message with new reminder and buttons, but handle "not modified" error
    const reminder = buildForceSubReminder(missing);
    const inlineKeyboard = buildForceSubButtons(missing);

    const timestamp = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const enhancedMessage = `${reminder}

📌 **Langkah-langkah:**
1️⃣ Klik tombol channel/grup di bawah untuk join
2️⃣ Pastikan sudah join semua channel yang diperlukan
3️⃣ Klik tombol **🔄 Cek Lagi** untuk verifikasi
4️⃣ Setelah terverifikasi, kirim ulang menfess Anda

⚠️ Pesan menfess Anda akan otomatis diproses setelah bergabung di semua channel.

🕒 Dicek pada: ${timestamp}`;

    try {
      await ctx.editMessageText(enhancedMessage, {
        reply_markup: {
          inline_keyboard: inlineKeyboard
        },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      // Handle "message not modified" error specifically
      if (error.response && error.response.error_code === 400 &&
          error.response.description.includes('message is not modified')) {
        // Message content is identical, just answer the callback
        await ctx.answerCbQuery('✅ Status sudah dicek! Kamu masih belum join semua channel yang diperlukan.');
        return false;
      }
      // Re-throw other errors
      throw error;
    }
    return false;
  }

  return true;
}

// Callback handler untuk tombol "Cek Lagi"
bot.action('retry_fsub_check', async (ctx) => {
  try {
    // Check subscription status using callback-specific function
    const subscribed = await checkSubscriptionFromCallback(ctx);

    if (subscribed) {
      // User is now subscribed to all channels
      await ctx.answerCbQuery('✅ Verifikasi berhasil!');
      await ctx.editMessageText(`✅ **Verifikasi Berhasil!**

Selamat! Anda sudah bergabung di semua channel yang diperlukan.

🎭 **Sekarang Anda dapat:**
• Kirim menfess dengan hashtag #boy atau #girl
• Menfess akan otomatis masuk ke antrean
• Pesan akan dikirim ke channel secara otomatis

📝 **Contoh menfess:**
\`#boy need fwb @usernamekamu!\`

Silakan kirim menfess Anda sekarang! 😊`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📝 Kirim Menfess', switch_inline_query_current_chat: '' }
          ]]
        }
      });
    } else {
      // If not subscribed, checkSubscriptionFromCallback handles the message update and callback answer
    }
  } catch (error) {
    console.error('Error in retry_fsub_check:', error);
    await ctx.answerCbQuery('Terjadi kesalahan. Silakan coba lagi.');
  }
});

// Enhanced command untuk cek status langganan manual
bot.command('cekfsub', async (ctx) => {
  const subscribed = await ensureSubscribed(ctx);

  if (subscribed) {
    await ctx.reply(`✅ **Status Keanggotaan: LENGKAP**

Anda sudah bergabung di semua channel yang diperlukan!
Silakan kirim menfess Anda dengan hashtag #boy atau #girl.

Contoh: \`#boy need fwb @usernamekamu!\``, {
      parse_mode: 'Markdown'
    });
  }
  // If not subscribed, ensureSubscribed will send the reminder automatically
});

bot.launch();
console.log('Bot menfess dengan fitur antrean otomatis berhasil dijalankan!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
