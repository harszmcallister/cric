import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import JSONCache from 'redis-json';

const app = express()
const redis = new Redis();
const jsonCache = new JSONCache(redis);

app.use(cors());

app.get('/matches', async function (req, res){

    const hrefs = await redis.smembers('matchHrefs');
    const matches = [];

    for(let h of hrefs){
        const match = await jsonCache.get(h);
        const tournament = match.title.split(',')[1].split('-')[0].trim() + ' • ' + match.series;
        const m = match.title.split('-')[0].trim();
        const status = match.status;
        const href = h;

        const teams = [];
        const scores = [];
        var counter = 0;

        if(match.innings != undefined && match.innings.length > 0){ 
            for(let inning of match.innings){
                counter += 1;
                var teamName = undefined; 
                if(inning.team != undefined){
                    teamName = inning.team.replace('Innings', '').replace('1st', '').replace('2nd', '').trim();
                    if(teams.length < 2)
                    {
                        teams.push(teamName);
                    }
                }
                if(inning.score != undefined){
                    if(scores.length == 2)
                    {
                        if(counter == 3)
                        {
                            if(match.title.includes('Test')){
                                scores[0] = (scores[0] + ' & ' + inning.score.split(' ')[0])
                            }
                            else{
                                scores[0] = (scores[0] + ' & ' + inning.score.replace(' Ov', ''))
                            }
                        }
                        else
                        {
                            if(match.title.includes('Test')){
                                scores[1] = (scores[1] + ' & ' + inning.score.split(' ')[0])
                            }
                            else{
                                scores[1] = (scores[1] + ' & ' + inning.score.replace(' Ov', ''))
                            }
                        }
                    }
                    else
                    {
                        if(match.title.includes('Test')){
                            scores.push(inning.score.split(' ')[0]);
                        }
                        else{
                            scores.push(inning.score.replace(' Ov', ''));
                        }
                    }
                }
            }
        }
        else{
            teams.push(match.title.split(',')[0].split('vs')[0].trim());
            teams.push(match.title.split(',')[0].split('vs')[1].trim());
        }

        if(teams.length == 1){
            if(!teams.includes(match.title.split(',')[0].split('vs')[0].trim()))
                teams.push(match.title.split(',')[0].split('vs')[0].trim());
            else
                teams.push(match.title.split(',')[0].split('vs')[1].trim());
        };


        if(scores.length > 0 && match.commentry.score != undefined && match.commentry.score.trim() != ''){
            if(scores.length > 2)
            {
                const commentryScoreSplit = match.commentry.score.split(' ');
                const commentryScore = commentryScoreSplit[1].trim() + ' ' +  commentryScoreSplit[2].trim(); 
                scores[scores.length - 1] = scores[scores.length - 1].split('&')[0].trim() + ' & ' + commentryScore
            }
            else{
                const commentryScoreSplit = match.commentry.score.split(' ');
                const commentryScore = commentryScoreSplit[1].trim() + ' ' +  commentryScoreSplit[2].trim(); 
                scores[scores.length - 1] = commentryScore;
            }
        }

        const matchObject = {
            tournament : tournament,
            match : m,
            href : href,
            teams : teams,
            scores : scores,
            status : status
        };

        matches.push(matchObject);
    }
    res.send(matches);
});

app.get('/scorecard', async function (req, res){
    const queryTerm = req.query.href;
    const result = await jsonCache.get(queryTerm);
    res.send(result);
});

app.get('/news', async function (req, res){
    const result = await redis.smembers('news');
    res.send(JSON.parse(result));
});

app.get('/newsDetail', async function (req, res){
    const queryTerm = req.query.href;
    const result = await jsonCache.get(queryTerm);
    res.send(result);
});

app.listen(3000);