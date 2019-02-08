import React, { Component } from 'react';
import 'reset-css/reset.css';
import './App.css';
import queryString from 'query-string';
import querystring from 'querystring';

let defaultStyle = {
  color: '#fff',
  'font-family': 'Papyrus'
};
let counterStyle = {...defaultStyle, 
  width: "40%", 
  display: 'inline-block',
  'margin-bottom': '20px',
  'font-size': '20px',
  'line-height': '30px'
}

let backEndUrl = window.location.href.includes('localhost') ? "http://localhost:8888" : "https://mod3backend.herokuapp.com"

function isEven(number) {
  return number % 2
}

function vote(connectCode, name, url) {
  fetch(backEndUrl + '/vote', {
    method : "PUT",
    headers : {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    body : JSON.stringify({
      "connectCode" : connectCode,
      "songName" : name,
      "songUrl" : url
    })
  })
}

class PlaylistCounter extends Component {
  render() {
    let playlistCounterStyle = counterStyle
    return (
      <div style={playlistCounterStyle}>
        <h2>{this.props.playlists.length} playlists</h2>
      </div>
    );
  }
}

class HoursCounter extends Component {
  render() {
    let allSongs = this.props.playlists.reduce((songs, eachPlaylist) => {
      return songs.concat(eachPlaylist.songs)
    }, [])
    let totalDuration = allSongs.reduce((sum, eachSong) => {
      return sum + eachSong.duration
    }, 0)
    let totalDurationHours = Math.round(totalDuration/60)
    let isTooLow = totalDurationHours < 40
    let hoursCounterStyle = {...counterStyle, 
      color: isTooLow ? 'red' : 'white',
      'font-weight': isTooLow ? 'bold' : 'normal',
    }
    return (
      <div style={hoursCounterStyle}>
        <h2>{totalDurationHours} hours</h2>
      </div>
    );
  }
}

class Filter extends Component {
  render() {
    return (
      <div style={defaultStyle}>
        <img/>
        <input type="text" onKeyUp={event => 
          this.props.onTextChange(event.target.value)}
          style={{...defaultStyle, 
            color: 'black', 
            'font-size': '20px', 
            padding: '10px'}}/>
      </div>
    );
  }
}

class Playlist extends Component {
  render() {
    let playlist = this.props.playlist
    return (
      <div style={{...defaultStyle, 
        display: 'inline-block', 
        width: "25%",
        padding: '10px',
        'background-color': isEven(this.props.index) 
          ? '#C0C0C0' 
          : '#808080'
        }}
        onClick={() => {
          playlist.songs.map(song => {
            vote(this.props.connectCode, song.name, song.url)
          })
          alert("voting")
        }}>
        <h2>{playlist.name}</h2>
        <img src={playlist.imageUrl} style={{width: '60px'}}/>
        <ul style={{'margin-top': '10px', 'font-weight': 'bold'}}>
          {playlist.songs.map(song => 
            <li style={{'padding-top': '2px'}}>{song.name}</li>
          )}
        </ul>
      </div>
    );
  }
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      serverData: {},
      filterString: '',
      connectCode: undefined,
      venueName: undefined
    }
  }
  componentDidMount() {
    let parsed = queryString.parse(window.location.search);
    let accessToken = parsed.access_token;
    if (!accessToken)
      return;
    fetch('https://api.spotify.com/v1/me', {
      headers: {'Authorization': 'Bearer ' + accessToken}
    }).then(response => response.json())
    .then(data => this.setState({
      user: {
        name: data.display_name
      }
    }))

    fetch('https://api.spotify.com/v1/me/playlists', {
      headers: {'Authorization': 'Bearer ' + accessToken}
    }).then(response => response.json())
    .then(playlistData => {
      let playlists = playlistData.items
      let trackDataPromises = playlists.map(playlist => {
        let responsePromise = fetch(playlist.tracks.href, {
          headers: {'Authorization': 'Bearer ' + accessToken}
        })
        let trackDataPromise = responsePromise
          .then(response => response.json())
        return trackDataPromise
      })
      let allTracksDataPromises = 
        Promise.all(trackDataPromises)
      let playlistsPromise = allTracksDataPromises.then(trackDatas => {
        trackDatas.forEach((trackData, i) => {
          playlists[i].trackDatas = trackData.items
            .map(item => item.track)
            .map(trackData => {
              console.log(trackData)
              return {
              name: trackData.name,
              url: trackData.uri,
              duration: trackData.duration_ms / 1000
            }})
        })
        return playlists
      })
      return playlistsPromise
    })
    .then(playlists => this.setState({
      playlists: playlists.map(item => {
        return {
          name: item.name,
          imageUrl: item.images[0].url, 
          songs: item.trackDatas.slice(0,3)
        }
    })
    }))

  }
  render() {
    let playlistToRender = 
      this.state.user && 
      this.state.playlists 
        ? this.state.playlists.filter(playlist => {
          let matchesPlaylist = playlist.name.toLowerCase().includes(
            this.state.filterString.toLowerCase()) 
          let matchesSong = playlist.songs.find(song => song.name.toLowerCase()
            .includes(this.state.filterString.toLowerCase()))
          return matchesPlaylist || matchesSong
        }) : []
    return (
      <div className="App">
        {this.state.user ?
        <div>
          <h1> See I (Andrew Fryer) can modify everything! </h1>
          <h1 style={{...defaultStyle, 
            'font-size': '54px',
            'margin-top': '5px'
          }}>
            {this.state.user.name}'s Playlists
          </h1>
          <PlaylistCounter playlists={playlistToRender}/>
          <HoursCounter playlists={playlistToRender}/>
          <Filter onTextChange={text => {
              this.setState({filterString: text})
            }}/>
          {playlistToRender.map((playlist, i) => 
            <Playlist playlist={playlist} index={i} connectCode={this.state.connectCode}/>
          )}

          <button onClick={() => {
            let name = prompt("Enter name: ");
            fetch(backEndUrl + '/create', {
              method : "POST",
              headers : {
                'Content-Type': 'application/json;charset=UTF-8'
              },
              body : JSON.stringify({"name" : name})
            })
            .then(function(response) {
              return response.json();
            })
            .then(response => {
              this.setState({
                connectCode : response.newConnectCode,
                venueName : name
              })
              console.log("connectCode: " + JSON.stringify(response.newConnectCode))
            })}
          }
          style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Create</button>

          {this.state.connectCode ?
          <div> 
            Connected To: {this.state.venueName}
            <button onClick={() => {
              let url = prompt("Enter song url");
              fetch(backEndUrl + '/vote', {
                method : "PUT",
                headers : {
                  'Content-Type': 'application/json;charset=UTF-8'
                },
                body : JSON.stringify({
                  connectCode : this.state.connectCode,
                  "songUrl" : url
                })
              })
              }
            }
            style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Vote</button>

            <button onClick={() => {
              let parsed = queryString.parse(window.location.search);
              let accessToken = parsed.access_token;
              var bestSong;
              fetch(backEndUrl + '/queue?' +
              querystring.stringify({
                connectCode : this.state.connectCode
              }), {
                method : "GET"
              })
              .then(function(response) {
                return response.json();
              })
              .then(function(response) {
                let songs = response;
                bestSong = songs[0]; // what if no songs?
                for(let i=0; i<songs.length; i++) {
                  console.log(songs[i])
                  if(songs[i].numVotes > bestSong.numVotes) {
                    bestSong = songs[i];
                  }
                }
              })
              .then(function() {
                fetch('https://api.spotify.com/v1/me/player/play', {
                  method : "PUT",
                  headers: {
                    'Authorization': 'Bearer ' + accessToken
                  },
                  body : JSON.stringify({"uris": [bestSong.url]})
                })
                console.log("Playing: " + bestSong.name)
              })
              }
            }
            style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Play song</button>

            <button onClick={() => {
              this.setState({
                connectCode: undefined,
                venueName: undefined       // TODO: switch to json instead of text
              })
              }
            }
            style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Leave</button>
          </div>
           : 
          <button onClick={() => {
            let connectCode = prompt("Enter connectCode: ");
            fetch(backEndUrl + '/join?' +
            querystring.stringify({
              "connectCode" : connectCode
            }), {
              method : "GET"
            })
            .then(function(response) {
              return response.text();
            })
            .then(response => {
              if(response !== "Could not connect") { // TODO: use status code instead
                this.setState({
                  connectCode: connectCode,
                  venueName: response       // TODO: switch to json instead of text
                })
                console.log("Connected to: " + response)
              } else {
                console.log("Could not connect")
              }
            })
            }
          }
          style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Join</button>
          }
        </div>
         : 
        <button onClick={() => {
            window.location = backEndUrl + '/login'
          }}
          style={{padding: '20px', 'font-size': '50px', 'margin-top': '20px'}}>Sign in with Spotify</button>
        }
      </div>
    );
  }
}

export default App;
