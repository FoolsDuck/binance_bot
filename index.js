const rsi = require("trading-indicator").rsi;
const indicators = require("trading-indicator");
const axios = require("axios");
const fs = require("fs");
const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const { channel, token } = require("./config.json");

// USE ANY JSON FILE OF TICKERS YOU WANT:
const jsonFile = require("./futures.json");

const getTrends = async () => {
  let finalData = [];
  let finalTickers = [];

  await axios
    .get(
      `https://www.binance.com/bapi/composite/v1/public/marketing/recommend/hotAsset/list?currency=USD&type=1`
    )
    .then((res) => {
      res.data.data.map((item) => {
        if (!finalData.includes(item.baseAsset)) {
          finalData.push(item.baseAsset);
        }
      });
    })
    .catch((err) => console.log(err));

  const trendingList = await Promise.all(
    finalData.map(async (item) => {
      return await axios
        .get(
          `https://www.binance.com/bapi/composite/v1/public/marketing/tardingPair/detail?symbol=${item}`
        )
        .then((res) => {
          let obj = {
            symbol: item,
            marketCap: res.data.data[0].marketCap,
            rank: res.data.data[0].rank,
            circulatingSupply: res.data.data[0].circulatingSupply,
            totalSupply: res.data.data[0].totalSupply,
            dayChange: res.data.data[0].dayChange,
          };
          return obj;
        })
        .catch((err) => console.log(err));
    })
  ).catch((err) => {
    console.log(err);
  });
  return trendingList;
};

const checkRsi = async (symbol, timeframe) => {
  try {
    return await indicators.rsiCheck(
      14,
      80,
      20,
      "binance",
      symbol,
      timeframe,
      false
    );
  } catch (err) {
    return err;
  }
};

const checkBreakout = async (symbol, timeframe) => {
  try {
    let macdData = await indicators.macd(
      12,
      26,
      9,
      "close",
      "binance",
      symbol,
      timeframe,
      true
    );

    const last2 = {
      prev: macdData[macdData.length - 2],
      last: macdData[macdData.length - 1],
    };

    if (
      last2.prev.MACD > last2.prev.signal &&
      last2.last.MACD < last2.last.signal
    ) {
      return true;
    } else return false;
  } catch (err) {
    return err;
  }
};

const login = async () => {
  if (!client || !client.readyAt) {
    try {
      const loggedIn = await client.login(token);
      console.log(`Logged in as ${client.user.tag}!`);
    } catch (err) {
      console.log(err);
    }
  }
};

const sendMsg = (msg) => {
  client.channels.cache.get(channel).send(msg);
};

const send = async (trends) => {
  // YOU CAN REPLACE jsonFile WITH trends
  const tickers = jsonFile.filter(
    (s) => !s.symbol.includes("DOWN") && !s.symbol.includes("UP")
  );

  await Promise.all(
    tickers.map(async (item, index) => {
      const ticker = item.symbol;
      const symbol = ticker.split("USDT")[0];
      // SET YOUR INTERVAL
      const interval = "5m";
      setTimeout(async () => {
        const rsiResult = await checkRsi(`${symbol}/USDT`, interval);
        const breakout = await checkBreakout(`${symbol}/USDT`, interval);

        item.rsi = rsiResult;
        item.breakout = breakout;
        let msg;
        if (breakout) {
          msg = `
                       BREAKOUT ALERT! (${interval} interval)

                       Symbol: ${symbol}/USDT
                       RSI_VALUE: ${rsiResult.rsiVal}
                       OverBought: ${rsiResult.overBought}
                       OverSold: ${rsiResult.overSold}

                       LINK: https://www.binance.com/en/trade/${symbol}_USDT
                       end.
                       `;
          sendMsg(msg);
        }
        if (rsiResult.overSold || rsiResult.overBought) {
          console.log({
            breakout: breakout,
            rsi: rsiResult,
          });
          msg = `
          ${
            rsiResult.overSold ? "OVERSOLD" : "OVERBOUGHT"
          } ALERT! (${interval} interval)

          Symbol: ${symbol}/USDT
          RSI_VALUE: ${rsiResult.rsiVal}
          OverBought: ${rsiResult.overBought}
          OverSold: ${rsiResult.overSold}

          LINK: https://www.binance.com/en/trade/${symbol}_USDT
          end.
          `;
          sendMsg(msg);
        }

        if (index === tickers.length - 1) {
          main(true);
        }
      }, 2000 * index);
    })
  ).catch((err) => console.log(err));
};

const main = async (isLoggedIn) => {
  if (!isLoggedIn) {
    await login();
  }
  const trends = await getTrends();
  const tickers = await send(trends);
};

main(false);
