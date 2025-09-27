const config = {
  botToken: '8305166785:AAEAQH2exa0CyJKWso78L8tDpDJOQkG9Iho',
  channelId: '@Blackpearlbaseofficial',
  photoBoyId: 'AgACAgIAAxkDAAIDMWcGxQjpTYVGPhVrFWR-V6iZO3C-AAL-5jEbLHaJS1VGZGb3P5xMAQADAgADeAADNgQ', // Replace with valid Telegram file ID
  photoGirlId: 'AgACAgIAAxkDAAIDMWcGxQjpTYVGPhVrFWR-V6iZO3C-AAL-5jEbLHaJS1VGZGb3P5xMAQADAgADeAADNgQ', // Replace with valid Telegram file ID
  sendDelayMs: 2000,
  forceSubChannels: [
    {
      id: -1001722785066,
      link: 'https://t.me/Blackpearlbaseofficial',
      label: 'MENFESS',
      buttonText: 'AUTO MENFESS'
    },
    {
      id: -1001999857761,
      link: 'https://t.me/+3_lpGQGGGeA2NWJl',
      label: 'BLACK PEARL BASE',
      buttonText: 'BASE'
    }
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
    if (normalized === null) {
      throw new Error(`config.forceSubChannels[${index}] tidak valid. Harus berupa string, number, atau object dengan property id/link.`);
    }
    return normalized;
  });

  config.forceSubChannels = normalizedEntries;
}

module.exports = { config, validateConfig };
