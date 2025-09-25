const config = {
  botToken: '8305166785:AAEAQH2exa0CyJKWso78L8tDpDJOQkG9Iho',
  channelId: '@VZLfxs',
  photoBoyId: 'GANTI_DENGAN_FILE_ID_FOTO_COWO',
  photoGirlId: 'GANTI_DENGAN_FILE_ID_FOTO_CEWE',
  sendDelayMs: 2000,
  forceSubChannels: []
};

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

  config.forceSubChannels.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`config.forceSubChannels[${index}] harus berupa objek dengan properti id dan opsional link.`);
    }

    if (!entry.id) {
      throw new Error(`config.forceSubChannels[${index}].id harus diisi dengan username channel atau ID grup yang valid.`);
    }

    if (entry.link && typeof entry.link !== 'string') {
      throw new Error(`config.forceSubChannels[${index}].link harus berupa string URL jika diisi.`);
    }

    if (entry.buttonText && typeof entry.buttonText !== 'string') {
      throw new Error(`config.forceSubChannels[${index}].buttonText harus berupa string jika diisi.`);
    }
  });

  if (Number.isNaN(Number(config.sendDelayMs)) || Number(config.sendDelayMs) < 0) {
    throw new Error('config.sendDelayMs harus berupa angka >= 0.');
  }
}

module.exports = {
  config,
  validateConfig
};
