export const MARSX_FINANCE_DESIGN=Object.freeze({
  id:"marsx-ecosystem-finance-v1",
  brand:{name:"MARS-X FINANCE",subtitle:"Financial Hub",accent:"#B93CFF",accentStrong:"#8A2BE2",cyan:"#00D8FF",orange:"#FF6A00",red:"#FF3131"},
  surface:{app:"#05070D",nav:"#080B12",card:"#0D111A",cardRaised:"#121827",stroke:"#382052",strokeActive:"#B93CFF",divider:"#202838"},
  text:{primary:"#F7F8FC",secondary:"#A9B3C6",muted:"#69758A",positive:"#16C784",negative:"#EA3943",warning:"#F5B642"},
  glow:{finance:"rgba(185,60,255,0.38)",cyan:"rgba(0,216,255,0.28)",orange:"rgba(255,106,0,0.25)"},
  radius:{sm:10,md:16,lg:22,pill:999},
  spacing:{xs:4,sm:8,md:12,lg:16,xl:24,xxl:32},
  navigation:[
    {id:"overview",label:"Overview",icon:"overview"},
    {id:"portfolio",label:"Portfolio",icon:"portfolio"},
    {id:"markets",label:"Markets",icon:"markets"},
    {id:"analytics",label:"Analytics",icon:"analytics"},
    {id:"more",label:"More",icon:"more"}
  ],
  homeCards:[
    {id:"portfolio",title:"Total Portfolio",metric:"portfolioValue",accent:"finance"},
    {id:"pnl",title:"24h P/L",metric:"dailyPnl",accent:"cyan"},
    {id:"risk",title:"Risk",metric:"riskState",accent:"orange"}
  ]
});

export function financeScreenModel({portfolio={},watchlist=[],marketStatus="READ_ONLY"}={}){
  return {
    design:MARSX_FINANCE_DESIGN.id,
    header:{brand:"MARS-X FINANCE",badge:marketStatus,actions:["search","notifications","profile"]},
    hero:{title:"Total Portfolio",value:portfolio.value??null,currency:portfolio.currency||"EUR",change24h:portfolio.change24h??null},
    quickActions:["assets","analytics","reports","ai"],
    sections:[
      {id:"watchlist",title:"Markets",component:"market-list",items:watchlist},
      {id:"chart",title:"Advanced Chart",component:"marsx-chart"},
      {id:"allocation",title:"Allocation",component:"allocation"},
      {id:"risk",title:"Risk & Exposure",component:"risk-summary"},
      {id:"intelligence",title:"MARS-X Intelligence",component:"signal-summary"}
    ],
    bottomNavigation:MARSX_FINANCE_DESIGN.navigation
  };
}
