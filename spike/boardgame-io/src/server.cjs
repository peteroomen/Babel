/** SPIKE — CJS workaround for the missing exports map. */
const { Server, Origins } = require('boardgame.io/server');
const BabelSpike = {
  name: 'babel-spike',
  setup: () => ({ round: 1, placed: [], hands: { '0': ['scheme-a'], '1': ['scheme-b'] } }),
  moves: { place: ({ G, playerID }, at) => ({ ...G, placed: [...G.placed, { playerID, at }] }) },
  playerView: ({ G, playerID }) => ({
    ...G,
    hands: Object.fromEntries(
      Object.entries(G.hands).map(([id, h]) => [id, id === playerID ? h : []]),
    ),
  }),
};
const server = Server({ games: [BabelSpike], origins: [Origins.LOCALHOST] });
server.run(8000, () => console.log('SPIKE_SERVER_UP'));
