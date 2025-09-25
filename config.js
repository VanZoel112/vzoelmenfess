const config = {
  botToken: 'GANTI_DENGAN_TOKEN_BOT_MASTER',
  channelId: '@UsernameChannelAtau-100xxxxxxxxxx',
  photoBoyId: 'GANTI_DENGAN_FILE_ID_FOTO_COWO',
  photoGirlId: 'GANTI_DENGAN_FILE_ID_FOTO_CEWE',
  sendDelayMs: 2000,
  forceSubChannels: [
    // Contoh format yang benar:
    // '@usernameChannel',
    // -1001234567890,
    // { id: '@usernameChannel', buttonText: 'Join Channel', link: 'https://t.me/usernameChannel' }
  ]
};

function normalizeForceSubEntry(entry) {
  if (entry === null || entry === undefined) return null;
  if (typeof entry === 'string' || typeof entry === 'number') return { id: entry };
  if (typeof entry === 'object') {
    const normalized = { ...entry };
    if (normalized.id === undefined && typeof normalized.link === 'string') {
      normalized.id = normalized.link;
    }
    return normalized;
  }
  return null;
}

function validateConfig() {
  if (config.botToken === 'GANTI_DENGAN_TOKEN_BOT_MASTER') {
    throw new Error('config.botToken harus diisi dengan token bot dari BotFather.');
  }
  if (config.channelId === '@UsernameChannelAtau-100xxxxxxxxxx') {
    throw new Error('config.channelId harus diisi dengan username channel atau ID grup yang valid.');
  }
  if (config.photoBoyId === 'GANTI_DENGAN_FILE_ID_FOTO_COWO') {
    throw new Error('config.photoBoyId harus diisi dengan file ID foto cowo.');
  }
  if (config.photoGirlId === 'GANTI_DENGAN_FILE_ID_FOTO_CEWE') {
    throw new Error('config.photoGirlId harus diisi dengan file ID foto cewe.');
  }
  if (!Array.isArray(config.forceSubChannels)) {
    throw new Error('config.forceSubChannels harus berupa array.');
  }

  const normalizedEntries = config.forceSubChannels.map((entry, index) => {
    const normalized = normalizeForceSubEntry(entry);
    if (!normalized) {
      throw new Error(`config.forceSubChannels[${index}] menggunakan format yang tidak dikenali. Gunakan string, number, atau objek dengan properti id.`);
    }
    return normalized;
  });

  normalizedEntries.forEach((entry, index) => {
    if (entry.id === undefined || entry.id === null || entry.id === '') {
      throw new Error(`config.forceSubChannels[${index}].id harus diisi dengan username channel atau ID grup yang valid.`);
    }
    if (entry.link && typeof entry.link !== 'string') {
      throw new Error(`config.forceSubChannels[${index}].link harus berupa string URL jika diisi.`);
    }
    if (entry.buttonText && typeof entry.buttonText !== 'string') {
      throw new Error(`config.forceSubChannels[${index}].buttonText harus berupa string jika diisi.`);
    }
  });

  config.forceSubChannels = normalizedEntries;

  if (Number.isNaN(Number(config.sendDelayMs)) || Number(config.sendDelayMs) < 0) {
    throw new Error('config.sendDelayMs harus berupa angka >= 0.');
  }
}

function getForceSubChannels() {
  return config.forceSubChannels.map((entry) => ({ ...entry }));
}

module.exports = {
  config,
  validateConfig,
  getForceSubChannels
};
