/*
  This file is used to store unsecure, application-specific data common to all
  environments.
*/

module.exports = {
  port: process.env.PORT || 3210,
  BCHADDR: `bitcoincash:qq8mk8etntclfdkny2aknh4ylc0uaewalszh5eytnr`,
  stateFileName: `state.json`,
  ipfsPort1: 4002,
  ipfsPort2: 4003
}
