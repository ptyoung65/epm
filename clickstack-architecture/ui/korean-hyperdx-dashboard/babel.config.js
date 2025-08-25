module.exports = {
  presets: [
    ['@babel/preset-react', {
      pragma: 'React.createElement',
      pragmaFrag: 'React.Fragment'
    }]
  ]
};