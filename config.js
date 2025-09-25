const config = {
  botToken: 'GANTI_DENGAN_TOKEN_BOT_MASTER',
  channelId: '@UsernameChannelAtau-100xxxxxxxxxx',
  photoBoyId: 'GANTI_DENGAN_FILE_ID_FOTO_COWO',
  photoGirlId: 'GANTI_DENGAN_FILE_ID_FOTO_CEWE'
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
}

module.exports = {
  config,
  validateConfig
};
