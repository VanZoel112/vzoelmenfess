const { Telegraf } = require('telegraf');
const { config, validateConfig } = require('./config');

validateConfig();

const BOT_TOKEN = config.botToken;
const CHANNEL_ID = config.channelId;
let PHOTO_BOY = config.photoBoyId;
let PHOTO_GIRL = config.photoGirlId;
const SEND_DELAY_MS = Number(config.sendDelayMs || 0);
const FORCE_SUB_CHANNELS = Array.isArray(config.forceSubChannels) ? config.forceSubChannels : [];
const OWNER_ID = config.ownerId;

// Debug logging for configuration
console.log('🔧 Bot Configuration:');
console.log(`📺 CHANNEL_ID: ${CHANNEL_ID}`);
console.log(`👦 PHOTO_BOY: ${PHOTO_BOY}`);
console.log(`👧 PHOTO_GIRL: ${PHOTO_GIRL}`);
console.log(`⏱️ SEND_DELAY_MS: ${SEND_DELAY_MS}`);
console.log(`👑 OWNER_ID: ${OWNER_ID}`);
console.log(`📋 FORCE_SUB_CHANNELS: ${FORCE_SUB_CHANNELS.length} channels`);
FORCE_SUB_CHANNELS.forEach((channel, index) => {
  console.log(`  ${index + 1}. ${channel.label} (${channel.id})`);
});

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
    const chatMember = await telegram.getChatMember(channelId, userId);
    const status = chatMember.status;

    console.log(`👤 User ${userId} status in channel ${channelId}: ${status}`);

    // Check if user is subscribed (not kicked or left)
    return !['left', 'kicked'].includes(status);

  } catch (error) {
    console.log(`🚫 Error checking subscription for user ${userId} in channel ${channelId}:`, error.response?.error_code, error.response?.description);

    // If user is not found or bot has no permission, consider as not subscribed
    if (error.response) {
      const errorCode = error.response.error_code;
      const description = error.response.description || '';

      // Common error cases - all result in not subscribed
      if (errorCode === 400 || errorCode === 403) {
        return false;
      }
    }

    // For any other error, assume not subscribed to be safe
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
    const isSubscribed = await isUserSubscribed(ctx.telegram, targetId, ctx.from.id);

    if (!isSubscribed) {
      console.log(`❌ User not subscribed to ${entry.label}`);
      missing.push(entry);
    } else {
      console.log(`✅ User subscribed to ${entry.label}`);
    }
  }

  console.log(`📊 Final missing channels: ${missing.length}`);

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
      console.log(`📷 Using photo ID: ${photoId}`);
      await bot.telegram.sendPhoto(CHANNEL_ID, photoId, {
        caption
      });
      console.log(`✅ Successfully sent menfess to channel`);
    } catch (error) {
      console.error('❌ Gagal mengirim menfess ke channel dengan foto:', error);

      // Simple fallback: try sending as text if photo fails
      const isPhotoError = error.response?.description?.includes('wrong file identifier') ||
                          error.response?.description?.includes('wrong remote file identifier') ||
                          error.response?.description?.includes('wrong padding');

      if (isPhotoError) {
        console.log('🔄 Photo error detected, trying text fallback...');
        try {
          await bot.telegram.sendMessage(CHANNEL_ID, caption);
          console.log(`✅ Fallback successful: Sent as text message`);

          console.error('💡 OWNER: Photo template needs update!');
          console.error('📝 Gunakan /setting untuk update photo template:');
          console.error('   1. Kirim foto ke bot untuk mendapatkan file ID');
          console.error('   2. Gunakan /setting boy [file_id] atau /setting girl [file_id]');
        } catch (textError) {
          console.error('❌ Text fallback also failed:', textError);
        }
      } else {
        console.error('❌ Non-photo related error, cannot fallback');
      }
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

🔒 Bot ini hanya bekerja di private chat untuk menjaga privasi kamu.

Ketik /help buat lihat panduan lengkapnya.

🤖 AutoFess dan FSub by Vzoel Fox's`);
});

bot.help(async (ctx) => {
  const joinLine = buildJoinLine();

  const helpMessage = [
    '📖 Panduan Kirim Menfess:',
    '',
    '🔒 PENTING: Bot ini hanya bekerja di private chat!',
    '⚠️ Jangan kirim perintah di grup atau channel.',
    '',
    joinLine,
    '- Pastikan kamu sudah punya username Telegram.',
    '- Sertakan salah satu hashtag #boy atau #girl di pesan menfess.',
    '- Setelah terkirim, bot bakal mengirimkan menfess kamu ke channel secara bergantian.',
    '',
    '📝 Contoh: #boy need fwb @usernamekamu!',
    '',
    '💡 Tips: Kirim menfess hanya di chat private dengan bot ini untuk menjaga privasi kamu.',
    '',
    '🤖 AutoFess dan FSub by Vzoel Fox\'s'
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

  ctx.reply(`Sip! Menfess kamu berhasil masuk antrean ${hashtag} dan akan otomatis dikirim ke channel. lihat dichannel ya dan tunggu kalo belum kekirim.

🤖 AutoFess dan FSub by Vzoel Fox's`);
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
    const isSubscribed = await isUserSubscribed(ctx.telegram, targetId, ctx.from.id);

    if (!isSubscribed) {
      console.log(`❌ [Callback] User not subscribed to ${entry.label}`);
      missing.push(entry);
    } else {
      console.log(`✅ [Callback] User subscribed to ${entry.label}`);
    }
  }

  console.log(`📊 [Callback] Final missing channels: ${missing.length}`);

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
      await ctx.editMessageText(`✅ Verifikasi Berhasil!

Selamat! Anda sudah bergabung di semua channel yang diperlukan.

🎭 Sekarang Anda dapat:
• Kirim menfess dengan hashtag #boy atau #girl
• Menfess akan otomatis masuk ke antrean
• Pesan akan dikirim ke channel secara otomatis

📝 Contoh menfess:
#boy need fwb @usernamekamu!

Silakan kirim menfess Anda sekarang! 😊

🤖 AutoFess dan FSub by Vzoel Fox's`, {
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

// Command untuk mendapatkan file ID dari foto
bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo;
  const largestPhoto = photo[photo.length - 1]; // Get highest resolution
  const fileId = largestPhoto.file_id;

  await ctx.reply(`📷 File ID foto ini adalah:
\`${fileId}\`

💡 Copy file ID di atas dan masukkan ke config.js:
- Untuk foto boy: photoBoyId
- Untuk foto girl: photoGirlId

🔄 Setelah update config, restart bot.

🤖 AutoFess dan FSub by Vzoel Fox's`, {
    parse_mode: 'Markdown'
  });
});

// Owner-only setting command untuk manage photo templates
bot.command('setting', async (ctx) => {
  // Check if user is owner
  if (ctx.from.id !== OWNER_ID) {
    await ctx.reply('❌ Command ini hanya untuk owner bot.');
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);

  if (args.length === 0) {
    // Show current photo settings
    await ctx.reply(`⚙️ **Bot Photo Settings:**

👦 **Photo Boy ID:**
\`${PHOTO_BOY}\`

👧 **Photo Girl ID:**
\`${PHOTO_GIRL}\`

📝 **Available Commands:**
\`/setting boy [file_id]\` - Set photo template untuk #boy
\`/setting girl [file_id]\` - Set photo template untuk #girl
\`/setting status\` - Show current settings

💡 **Cara mendapatkan file ID:**
1. Kirim foto ke bot
2. Bot akan reply dengan file ID
3. Copy file ID dan gunakan command di atas

🤖 AutoFess dan FSub by Vzoel Fox's`, { parse_mode: 'Markdown' });
    return;
  }

  const command = args[0];
  const value = args[1];

  switch (command) {
    case 'boy':
      if (value) {
        PHOTO_BOY = value;
        await ctx.reply(`✅ Photo template untuk #boy berhasil diupdate!

📷 File ID: \`${value}\`

Template akan digunakan untuk semua menfess dengan hashtag #boy.`);
      } else {
        await ctx.reply('❌ File ID diperlukan. Format: /setting boy [file_id]');
      }
      break;

    case 'girl':
      if (value) {
        PHOTO_GIRL = value;
        await ctx.reply(`✅ Photo template untuk #girl berhasil diupdate!

📷 File ID: \`${value}\`

Template akan digunakan untuk semua menfess dengan hashtag #girl.`);
      } else {
        await ctx.reply('❌ File ID diperlukan. Format: /setting girl [file_id]');
      }
      break;

    case 'status':
      await ctx.reply(`📊 **Current Photo Settings:**

👦 **Boy Photo:** ${PHOTO_BOY ? '✅ SET' : '❌ NOT SET'}
👧 **Girl Photo:** ${PHOTO_GIRL ? '✅ SET' : '❌ NOT SET'}

🔄 Template photos akan digunakan untuk semua menfess sesuai hashtag.`);
      break;

    default:
      await ctx.reply('❌ Unknown command. Use /setting to see available options.');
  }
});

// Main text handler untuk menfess
bot.on('text', async (ctx) => {
  // Skip commands
  if (ctx.message.text.startsWith('/')) {
    return;
  }

  const userMessage = ctx.message.text;
  const fromUser = ctx.from;

  // Check force subscription first
  if (!(await ensureSubscribed(ctx))) {
    return;
  }

  // Validasi username wajib
  if (!fromUser.username) {
    await ctx.reply(`❌ Username Telegram diperlukan untuk menfess!

📝 Cara setting username:
1. Buka Settings Telegram
2. Pilih Username
3. Buat username unik
4. Coba kirim menfess lagi

🤖 AutoFess dan FSub by Vzoel Fox's`);
    return;
  }

  // Validasi hashtag wajib
  const hashtag = userMessage.includes('#boy') ? '#boy' : userMessage.includes('#girl') ? '#girl' : null;

  if (!hashtag) {
    await ctx.reply(`❌ Hashtag wajib untuk menfess!

📝 Gunakan salah satu hashtag:
• #boy - untuk menfess dari cowok
• #girl - untuk menfess dari cewek

Contoh: #boy cari teman ngobrol @${fromUser.username}

🤖 AutoFess dan FSub by Vzoel Fox's`);
    return;
  }

  // Validasi username dalam pesan (opsional tapi direkomendasikan)
  if (!userMessage.includes('@')) {
    await ctx.reply(`⚠️ Peringatan: Menfess tidak menyertakan username!

💡 Untuk respons yang lebih baik, sertakan username kamu:
Contoh: ${hashtag} looking for friends @${fromUser.username}

Lanjutkan kirim menfess? Kirim ulang dengan format yang sama jika sudah yakin.

🤖 AutoFess dan FSub by Vzoel Fox's`);
    return;
  }

  const photoToSend = hashtag === '#boy' ? PHOTO_BOY : PHOTO_GIRL;
  // Hapus sender ID untuk anonymity, hanya tampilkan pesan asli
  const caption = userMessage;

  enqueueMenfess(photoToSend, caption);

  await ctx.reply(`✅ Menfess ${hashtag} berhasil masuk antrean!

📤 Akan otomatis dikirim ke channel @Blackpearlbaseofficial
⏰ Tunggu beberapa saat untuk pemrosesan
👁️ Cek channel untuk melihat menfess kamu

🤖 AutoFess dan FSub by Vzoel Fox's`);
});

// Enhanced command untuk cek status langganan manual
bot.command('cekfsub', async (ctx) => {
  const subscribed = await ensureSubscribed(ctx);

  if (subscribed) {
    await ctx.reply(`✅ Status Keanggotaan: LENGKAP

Anda sudah bergabung di semua channel yang diperlukan!
Silakan kirim menfess Anda dengan hashtag #boy atau #girl.

Contoh: #boy need fwb @usernamekamu!

🤖 AutoFess dan FSub by Vzoel Fox's`);
  }
  // If not subscribed, ensureSubscribed will send the reminder automatically
});

bot.launch();
console.log('Bot menfess dengan fitur antrean otomatis berhasil dijalankan!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
