import React, { useState } from 'react';
export const MARSXFinanceTradingTerminal = () => {
  const [tab, S] = useState('Trade'),
    [pair, P] = useState('BTC/USDT'),
    [tf, T] = useState('1H'),
    [side, B] = useState('Buy'),
    [amount, A] = useState('100'),
    [msg, M] = useState('');
  const bars = Array.from({
    length: 40
  }, (_, i) => {
    const v = 55 + Math.sin(i * .4) * 13 + Math.cos(i * .17) * 8;
    return {
      a: v,
      b: v + Math.sin(i * 2) * 7
    };
  });
  return <main className="bg-[#0b1018] text-white p-4 rounded-xl min-h-[680px]"><header className="flex justify-between items-center border-b border-slate-700 pb-4"><b className="text-xl"><span className="text-orange-500">MARS</span>-X FINANCE</b><small className="text-orange-300">DEMO</small></header><nav className="flex flex-wrap gap-2 my-5">{['Trade', 'Markets', 'Portfolio', 'Swap'].map(x => <button className={'px-4 py-3 rounded ' + (tab === x ? 'bg-orange-500 text-black' : 'bg-slate-800')} onClick={() => {
        S(x);
        M('');
      }}>{x}</button>)}</nav>{tab === 'Trade' ? <div className="grid md:grid-cols-[1fr_240px] gap-4"><section className="bg-[#151d28] rounded-xl p-4 min-w-0"><div className="flex flex-wrap justify-between gap-2"><select aria-label="Market" className="bg-slate-800 rounded p-3" value={pair} onChange={e => P(e.target.value)}>{['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'].map(x => <option>{x}</option>)}</select><strong className="text-emerald-400">$67,482.20 <small className="text-slate-400">sample</small></strong></div><div className="flex flex-wrap gap-2 my-5">{['15M', '1H', '4H', '1D', '1W'].map(x => <button className={'rounded px-3 py-2 ' + (tf === x ? 'bg-orange-500 text-black' : 'bg-slate-700')} onClick={() => T(x)}>{x}</button>)}</div><svg viewBox="0 0 600 290" className="w-full" role="img" aria-label="Illustrative candlestick chart">{[50, 110, 170, 230].map(y => <line x1="0" x2="600" y1={y} y2={y} stroke="#2b3848" />)}{bars.map((b, i) => {
            const x = i * 14 + 15,
              y = v => 265 - (v - 30) * 2.1;
            return <g stroke={b.b >= b.a ? '#22c9a0' : '#f07182'} fill={b.b >= b.a ? '#22c9a0' : '#f07182'}><line x1={x} x2={x} y1={y(Math.max(b.a, b.b) + 6)} y2={y(Math.min(b.a, b.b) - 6)} /><rect x={x - 4} y={Math.min(y(b.a), y(b.b))} width="8" height={Math.max(2, Math.abs(y(b.a) - y(b.b)))} /></g>;
          })}</svg><p className="text-slate-400 text-xs">Illustrative data · {tf} · Not live</p></section><section className="bg-[#151d28] rounded-xl p-4"><h2 className="font-bold mb-4">Demo order</h2><div className="flex gap-2">{['Buy', 'Sell'].map(x => <button onClick={() => B(x)} className={'flex-1 p-3 rounded ' + (side === x ? x === 'Buy' ? 'bg-emerald-600' : 'bg-rose-600' : 'bg-slate-700')}>{x}</button>)}</div><label className="block mt-5 mb-2">Amount (USDT)</label><input type="number" min="1" className="w-full bg-slate-800 p-3 rounded" value={amount} onChange={e => A(e.target.value)} /><button className="w-full mt-4 bg-orange-500 text-black p-3 rounded font-bold" onClick={() => M(Number(amount) > 0 ? 'Simulated ' + side + ' only. No order placed.' : 'Enter a positive amount.')}>Simulate {side}</button><p aria-live="polite" className="mt-4 text-orange-300">{msg}</p></section></div> : <section className="bg-[#151d28] p-5 rounded-xl"><h2 className="text-xl mb-4">{tab}</h2>{tab === 'Markets' ? ['BTC', 'ETH', 'SOL', 'BNB'].map(x => <button className="w-full text-left border-b border-slate-700 p-4" onClick={() => {
        P(x + '/USDT');
        S('Trade');
      }}>{x}/USDT →</button>) : tab === 'Portfolio' ? <p>Demo portfolio: $10,000 · No wallet connected.</p> : <><label className="block">USDT amount</label><input type="number" value={amount} onChange={e => A(e.target.value)} className="bg-slate-800 p-3 rounded mt-2" /><button onClick={() => M('Preview only. No swap executed.')} className="block bg-orange-500 text-black rounded p-3 mt-4">Preview swap</button><p aria-live="polite">{msg}</p></>}</section>}<p className="text-slate-500 text-xs mt-6">MARS-X Finance prototype • No live trading</p></main>;
};