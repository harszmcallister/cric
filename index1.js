import puppeteer from "puppeteer";
import Redis from 'ioredis';
import JSONCache from 'redis-json';
import schedule from 'node-schedule';

const redis = new Redis();
const jsonCache = new JSONCache(redis);

const browser = await puppeteer.launch(
    {
        headless : true,
        defaultViewport : false
    }
);

const matches = async function GetMatches(){
    const page = await browser.newPage();
    await page.goto('https://www.cricbuzz.com/');
    const titleNode = await page.$$("li[class='cb-view-all-ga cb-match-card cb-bg-white']");
    if(redis.exists('matchHrefs')){
       await redis.del('matchHrefs');
    }
    for(let t of titleNode) {
        const href = await t.$eval("a", el => el.getAttribute("href") );
        await redis.sadd('matchHrefs', href);
    };
    await page.close();
};

const news = async function GetNews(){
    const page = await browser.newPage();
    await page.goto('https://www.cricbuzz.com/cricket-news');
    const newsElement = await page.$("div[id='news-list']");
    const newsNodes = await newsElement.$$("div[class='cb-col cb-col-100 cb-lst-itm cb-pos-rel cb-lst-itm-lg']");
    const news = [];
    if(redis.exists('news')){
       await redis.del('news');
    }
    for(let t of newsNodes){
        const href = await t.$eval("a", el => el.getAttribute("href"));
        const headLine = await t.$eval("h2[class='cb-nws-hdln cb-font-18 line-ht24']", el => el.textContent);
        const shortDesc = await t.$eval("div[class='cb-nws-intr']", el => el.textContent);
        const newsObject = {
                                href : href,
                                headLine : headLine,
                                shortDesc : shortDesc
                            }
        news.push(newsObject);
    };
    await redis.sadd('news',  JSON.stringify(news));
    await page.close();
};

const newsDetails = async function setDetails() {
    const browser = await puppeteer.launch(
        {
            headless : true,
            defaultViewport : false
        }
    );
    const page = await browser.newPage();
    const news = JSON.parse(await redis.smembers('news'));

        for(let t of news)
        {
            await page.goto('https://www.cricbuzz.com'+ t.href.toString());
            let headLineElement = await page.$("h1[class='nws-dtl-hdln']");
            if(headLineElement == undefined){
                headLineElement = await page.$("h1[class='spt-nws-dtl-hdln']");
            }
            const headLine = await headLineElement.evaluate(el => el.textContent);
            const content = await page.$$eval("p[class='cb-nws-para']", el => { return el.map(e => e.textContent)});
            const newsObject = 
            {
                headLine : headLine,
                content : content
            }
            await jsonCache.set(t.href, newsObject);
        }

    await page.close();
}

const matchDetails = async function SetMatchDetails(){
    const hrefs = await redis.smembers('matchHrefs');
    for(let href of hrefs)
    {
        try
        {
            const page = await browser.newPage();
            const url = "https://www.cricbuzz.com" + href;
            await page.goto(url);

            const commentryScoreElement = await page.$("h2[class='cb-font-20 text-bold inline-block ng-binding']") || undefined;
            const commentry = {};

            if(commentryScoreElement != undefined)
            {
                Object.assign(commentry, {score : await commentryScoreElement.evaluate(el => el.textContent)});
            }

            const navElements = await page.$("nav[class='cb-nav-bar']");
            const navAnchors = await navElements.$$("a");
            const navObject = {};

            for(let navAnchor of navAnchors)
            {
                const navOption = await navAnchor.evaluate(el => el.innerHTML)
                const navHref = await navAnchor.evaluate(el => el.getAttribute('href'));
                navObject[navOption] = navHref;
            }
            
            await page.goto("https://www.cricbuzz.com/" + navObject["Scorecard"])

            let statusElement = await page.$("div[class='cb-col cb-scrcrd-status cb-col-100 cb-text-complete ng-scope']") || undefined;
            if(statusElement == undefined)
            { 
                statusElement = await page.$("div[class='cb-col cb-scrcrd-status cb-col-100 cb-text-preview ng-scope']") || undefined;
                if(statusElement == undefined)
                {
                    statusElement = await page.$("div[class='cb-col cb-scrcrd-status cb-col-100 cb-text-live ng-scope']") || undefined;
                }
            }
            const headerTitleElement = await page.$("h1[class='cb-nav-hdr cb-font-18 line-ht24']") || undefined;
            const subHeaderElement = await page.$("div[class='cb-nav-subhdr cb-font-12']") || undefined;
            

            const inningsList = [];
            for(let i=1; i<=4; i++){
                const inningsElement = "div[id='" + "innings_" + i + "']";

                const innings = await page.$(inningsElement) || undefined;
                if(innings != undefined)
                {

                    const team = await innings.$eval(`xpath/${'div[1]/div[1]/span[1]'}`, el=> el.textContent);
                    const score = await innings.$eval(`xpath/${'div[1]/div[1]/span[2]'}`, el=> el.textContent);

                    const battingElements = await innings.$$("div[class='cb-col cb-col-100 cb-scrd-itms']"); 
                    let battingStats = [];
                    for(let battingElement of battingElements)
                    {
                        let name = "";
                        let bowled = "";
                        let runs = "";
                        let balls = "";
                        let fours = "";
                        let sixes = "";
                        let strikeRate = "";
                        try
                        {
                            name = await battingElement.$eval("a", el => el.textContent);
                            bowled = await battingElement.$eval("div[class='cb-col cb-col-33']", el => el.textContent);
                            runs = await battingElement.$eval("div[class='cb-col cb-col-8 text-right text-bold']", el => el.textContent);
                            balls = await battingElement.$eval(`xpath/${'div[4]'}`, el => el.textContent);
                            fours = await battingElement.$eval(`xpath/${'div[5]'}`, el => el.textContent);
                            sixes = await battingElement.$eval(`xpath/${'div[6]'}`, el => el.textContent);
                            strikeRate = await battingElement.$eval(`xpath/${'div[7]'}`, el => el.textContent);
                        }
                        catch 
                        {

                        }

                        battingStats.push({
                            name : name.trim(),
                            bowled : bowled.trim(),
                            runs : runs,
                            balls : balls,
                            fours : fours,
                            sixes : sixes,
                            strikeRate : strikeRate
                        });
                    }

                    battingStats = battingStats.filter(item => item.name != "" && item.bowled != "" && item.runs != "" && item.balls != "" && item.fours != "" && item.sixes != "");

                    var extras  = undefined;
                    var extrasDetails = undefined;
                    var total = undefined;
                    var totalDetails = undefined;
                    var yetToBat = undefined;

                    if(battingElements.length == 13)
                    {
                        const lastElement = await battingElements[battingElements.length - 1];
                        const thirdDiv = await lastElement.$eval(`xpath/${'div[2]'}`, el => el.textContent) || undefined;

                        if(thirdDiv  == undefined)
                        { 
                            const extrasElement =  await battingElements[battingElements.length - 2];
                            extras = await extrasElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            extrasDetails = await extrasElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                            const totalElement =  await battingElements[battingElements.length - 1];
                            total = await totalElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            totalDetails = await totalElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                        }
                        else
                        {
                            const extrasElement =  await battingElements[battingElements.length - 3];
                            extras = await extrasElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            extrasDetails = await extrasElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                            const totalElement =  await battingElements[battingElements.length - 2];
                            total = await totalElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            totalDetails = await totalElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                            const yetToBatElement =  await battingElements[battingElements.length - 1];
                            yetToBat = await yetToBatElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                        }
                    }
                    else
                    {
                        const extrasElement =  await battingElements[battingElements.length - 3];
                        extras = await extrasElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                        extrasDetails = await extrasElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                        const totalElement =  await battingElements[battingElements.length - 2];
                        total = await totalElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                        totalDetails = await totalElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                        const yetToBatElement =  await battingElements[battingElements.length - 1];
                        yetToBat = await yetToBatElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                    }
                    const fallOfWickets = await innings.$eval("div[class='cb-col cb-col-100 cb-col-rt cb-font-13']", el => el.textContent);

                    const bowlingElements =  await innings.$$("div[class='cb-col cb-col-100 cb-scrd-itms ']")
                    let bowlingStats = [];

                    for(let bowlingElement of bowlingElements){

                        let name = "";
                        let overs = "";
                        let maidens = "";
                        let runs = "";
                        let wickets = "";
                        let noBalls = "";
                        let wides = "";
                        let economy = "";

                        try
                        {
                            name = await bowlingElement.$eval("a", el => el.textContent);
                            overs = await bowlingElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            maidens = await bowlingElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                            runs = await bowlingElement.$eval(`xpath/${'div[4]'}`, el => el.textContent);
                            wickets = await bowlingElement.$eval(`xpath/${'div[5]'}`, el => el.textContent);
                            noBalls = await bowlingElement.$eval(`xpath/${'div[6]'}`, el => el.textContent);
                            wides = await bowlingElement.$eval(`xpath/${'div[7]'}`, el => el.textContent);
                            economy = await bowlingElement.$eval(`xpath/${'div[8]'}`, el => el.textContent);
                        }
                        catch 
                        {

                        }

                        bowlingStats.push({
                            name : name.trim(),
                            overs : overs,
                            maidens : maidens,
                            runs : runs,
                            wickets : wickets,
                            noBalls : noBalls,
                            wides : wides,
                            economy : economy
                        });
                    }

                    const powerplayElements = await innings.$$(`xpath/${'div[5]/div[2]'}`);
                    let powerplay = [];

                    for(let powerplayElement of powerplayElements){

                        let powerplayType = "";
                        let overs = "";
                        let runs = "";

                        try
                        {
                            powerplayType = await powerplayElement.$eval(`xpath/${'div[1]'}`, el => el.textContent);
                            overs = await powerplayElement.$eval(`xpath/${'div[2]'}`, el => el.textContent);
                            runs = await powerplayElement.$eval(`xpath/${'div[3]'}`, el => el.textContent);
                        }
                        catch
                        {

                        }

                        powerplay.push({
                            powerplayType : powerplayType.trim(),
                            overs : overs,
                            runs : runs
                        });
                    }

                    const inning = {
                        team : team,
                        score : score,
                        battingStats : battingStats,
                        bowlingStats : bowlingStats,
                        extras: extras.trim(),
                        extrasDetails: extrasDetails.trim(),
                        total: total.trim(),
                        totalDetails: totalDetails.trim(),
                        fallOfWickets: fallOfWickets
                    };
                    if(yetToBat != undefined)
                    {
                        Object.assign(inning, {yetToBat : yetToBat.trim()});
                    }
                    if(powerplay.length > 0){
                        Object.assign(inning, {powerplay : powerplay});
                    }
                    inningsList.push(inning)
                }
            }

            let matchInfoTable = await page.$(`xpath/${'//*[@id="page-wrapper"]/div[4]/div[2]/div[3]'}`) || undefined;

            var matchInfoMatch = undefined;
            var matchInfoDate = undefined;
            var matchInfoToss = undefined;
            var matchInfoTime = undefined;
            var matchInfoVenue = undefined;
            var matchInfoUmpires = undefined;
            var matchInfo3rdUmpire = undefined;
            var matchInfoReferee = undefined;
            var matchInfo = undefined;
            const squads = [];

            if(matchInfoTable != undefined)
                {
                    let matchInfoElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-mtch-info-itm']") || undefined;
            
                    if(matchInfoElements != undefined)
                    {
                        if(matchInfoElements.length == 0)
                        {
                            matchInfoTable = await page.$(`xpath/${'//*[@id="page-wrapper"]/div[4]/div[2]/div[4]'}`) || undefined;
                            if(matchInfoTable != undefined){
                                matchInfoElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-mtch-info-itm']") || undefined;
                            }
                            if(matchInfoElements.length == 0)
                            {
                                matchInfoTable = await page.$(`xpath/${'//*[@id="page-wrapper"]/div[4]/div[2]/div[5]'}`) || undefined;
                                if(matchInfoTable != undefined){
                                    matchInfoElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-mtch-info-itm']") || undefined;
                                }
                                if(matchInfoElements.length == 0)
                                {
                                    matchInfoTable = await page.$(`xpath/${'//*[@id="page-wrapper"]/div[4]/div[2]/div[6]'}`) || undefined;
                                    if(matchInfoTable != undefined){
                                        matchInfoElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-mtch-info-itm']") || undefined;
                                    }
                                }
                            }
                        }
            
                        if(matchInfoElements != undefined && matchInfoElements.length > 0)
                        {
                            // let statusCheck = await page.$("div[class='cb-col cb-scrcrd-status cb-col-100 cb-text-preview ng-scope']") || undefined;
                            // if(statusCheck == undefined)
                            // {
                            //     statusCheck = await page.$("div[class='cb-col cb-col-100 cb-font-18 cb-toss-sts cb-text-toss']") || undefined;
                            // }
            
                            // const matchAbandonedWithNoTossCheckElement = await page.$("div[class='cb-col cb-scrcrd-status cb-col-100 cb-text-complete ng-scope']") || undefined;
                            // var matchAbandonedWithNoTossCheck = false;
                            // if(matchAbandonedWithNoTossCheckElement != undefined)
                            // {
                            //     const matchAbandonedWithNoTossText = await matchAbandonedWithNoTossCheckElement.evaluate(el => el.textContent);
                            //     if(matchAbandonedWithNoTossText == "Match abandoned due to rain (no toss)"){
                            //         matchAbandonedWithNoTossCheck = true;
                            //     }
                            // }

                            let isTablePresent = await page.$("div[class='cb-col cb-col-100 cb-ltst-wgt-hdr']") || undefined;
            
                            if(isTablePresent == undefined)
                            {
                                matchInfoMatch = await matchInfoElements[0].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoDate = await matchInfoElements[1].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoTime = await matchInfoElements[2].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoVenue = await matchInfoElements[3].$eval(`xpath/${'div[2]'}`, el => el.textContent);
            
                                if(matchInfoElements.length > 4)
                                {
                                    matchInfoUmpires = await matchInfoElements[4].$eval(`xpath/${'div[2]'}`, el => el.textContent);
            
                                    if(matchInfoElements.length == 6)
                                    {
                                        matchInfoReferee = await matchInfoElements[5].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                    }
                                    else
                                    {
                                        if(matchInfoElements.length > 6)
                                        {
                                            matchInfo3rdUmpire = await matchInfoElements[5].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                            matchInfoReferee = await matchInfoElements[6].$eval(`xpath/${'div[2]'}`, el => el.textContent)
                                        }
                                    }
                                }
                                
                                const squadElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-minfo-tm-nm']");
                                
                                const squad1Name =  await squadElements[0].evaluate(el => el.textContent);
                                const squad1Players = await squadElements[1].evaluate(el => el.textContent);
                                
                                const squad1 = {
                                    name : squad1Name.trim(),
                                    players : squad1Players.trim()
                                };
            
                                const squad2Name =  await matchInfoTable.$eval("div[class='cb-col cb-col-100 cb-minfo-tm-nm cb-minfo-tm2-nm']", el => el.textContent);
                                const squad2Players = await squadElements[2].evaluate(el => el.textContent);
            
                                const squad2 = {
                                    name : squad2Name.trim(),
                                    players : squad2Players.trim()
                                };
            
                                squads.push(squad1);
                                squads.push(squad2);
                            }
                            else
                            {
                                matchInfoMatch = await matchInfoElements[0].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoDate = await matchInfoElements[1].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoToss = await matchInfoElements[2].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoTime = await matchInfoElements[3].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                matchInfoVenue = await matchInfoElements[4].$eval(`xpath/${'div[2]'}`, el => el.textContent);
            
                                if(matchInfoElements.length == 7)
                                {
                                    matchInfoReferee = await matchInfoElements[6].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                }
                                else
                                {
                                    if(matchInfoElements.length > 6)
                                    {
                                        matchInfoUmpires = await matchInfoElements[5].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                        matchInfo3rdUmpire = await matchInfoElements[6].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                        matchInfoReferee = await matchInfoElements[7].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                    }
                                }
            
                                const squadElements = await matchInfoTable.$$("div[class='cb-col cb-col-100 cb-minfo-tm-nm']");
                                
                                const squad1Name =  await squadElements[0].evaluate(el => el.textContent);
                                const squad1Playing = await squadElements[1].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                const squad1Bench = await squadElements[2].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                const squad1SupportStaff = await squadElements[3].$eval(`xpath/${'div[2]'}`, el => el.textContent);
            
                                const squad1 = {
                                    name : squad1Name.trim(),
                                    playing : squad1Playing.trim(),
                                    bench : squad1Bench.trim(),
                                };
            
                                if(squad1SupportStaff.trim() != "")
                                {
                                    Object.assign(squad1, {supportStaff : squad1SupportStaff.trim()});
                                }
            
                                const squad2Name =  await matchInfoTable.$eval("div[class='cb-col cb-col-100 cb-minfo-tm-nm cb-minfo-tm2-nm']", el => el.textContent);
                                const squad2Playing = await squadElements[4].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                const squad2Bench = await squadElements[5].$eval(`xpath/${'div[2]'}`, el => el.textContent);
                                const squad2SupportStaff = await squadElements[6].$eval(`xpath/${'div[2]'}`, el => el.textContent);
            
                                const squad2 = {
                                    name : squad2Name.trim(),
                                    playing : squad2Playing.trim(),
                                    bench : squad2Bench.trim()
                                };
            
                                if(squad1SupportStaff.trim() != "")
                                {
                                    Object.assign(squad2, {supportStaff : squad2SupportStaff.trim()});
                                }
            
                                squads.push(squad1);
                                squads.push(squad2);
                            }
            
                            matchInfo = {
                                match : matchInfoMatch.trim(),
                                date : matchInfoDate.trim(),
                                time : matchInfoTime.trim(),
                                venue : matchInfoVenue.trim()
                            }
            
                            if(matchInfoUmpires != undefined)
                            {
                                Object.assign(matchInfo, {umpires : matchInfoUmpires.trim()});
                            }
            
                            if(matchInfoReferee != undefined)
                            {
                                Object.assign(matchInfo, {referee : matchInfoReferee.trim()});
                            }
            
                            if(matchInfoToss != undefined)
                            {
                                Object.assign(matchInfo, {toss : matchInfoToss.trim()});
                            }
            
                            if(matchInfo3rdUmpire != undefined)
                            {
                                Object.assign(matchInfo, {thirdUmpire : matchInfo3rdUmpire.trim()});
                            }
                
                        
                            if(squads.length > 0)
                            {
                                Object.assign(matchInfo, {squads : squads});
                            }
                        }
                    }
                }

            const scorecard = {};
            if(headerTitleElement != undefined)
            {
                Object.assign(scorecard, {title : await headerTitleElement.evaluate(el => el.textContent)});
            }
            if(subHeaderElement != undefined)
            {
                const subHeaderAnchors = await subHeaderElement.$$eval("a", el => { return el.map(e => e.textContent)});
                Object.assign(scorecard, {series : subHeaderAnchors[0]});
                Object.assign(scorecard, {venue : subHeaderAnchors[1]});
            }
            if(statusElement != undefined)
            {
                Object.assign(scorecard, {status : await statusElement.evaluate(el => el.textContent)});
            }
            if(inningsList.length > 0)
            {
                Object.assign(scorecard, {innings : inningsList});
            }

            if(matchInfo != undefined){
                Object.assign(scorecard, {matchInfo : matchInfo});
            }

            if(commentryScoreElement != undefined){
                Object.assign(scorecard, {commentry : commentry});
            }

            //await browser.close();
            await page.close();
            await jsonCache.set(href, scorecard);
        }
        catch
        {
            console.log(href);
        }
    }
}
schedule.scheduleJob('*/5 * * * *', matches);
schedule.scheduleJob('*/4 * * * * *', matchDetails);
schedule.scheduleJob('*/2 * * * *', news);
schedule.scheduleJob('*/2 * * * *', newsDetails);