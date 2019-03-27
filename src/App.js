import React, { Component } from 'react';
import 'reset-css/reset.css';
import './App.css';
import queryString from 'query-string';
import querystring from 'querystring';
import io from 'socket.io-client';

let backEndUrl = window.location.href.includes('localhost') ? "http://localhost:8888" : "https://mod3backend.herokuapp.com"

const socket = io(backEndUrl)
socket.on('connect', () => {
  console.log("connected to backend socket")
})

let defaultStyle = {
  color: '#fff'
};

function isEven(number) {
  return number % 2
}

class Filter extends Component {
  render() {
    return (
      <div style={defaultStyle}>
        <input type="text" onKeyUp={event => 
          this.props.onTextChange(event.target.value)}
          style={{...defaultStyle, 
            color: 'black', 
            'fontSize': '20px', 
            padding: '10px',
            display: "block",
            width: "500px"}}/>
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
          if(this.props.connected) {
            playlist.songs.forEach(track => {
              this.props.vote(track)
              console.log("voting for: " + track.name)
            })
          }
        }}>
        <h2>{playlist.name}</h2>
        <img src={playlist.imageUrl} alt="" style={{width: '60px'}}/>
        <ul style={{'marginTop': '10px', 'font-weight': 'bold'}}>
          {playlist.songs.map(song => 
            <li style={{'padding-top': '2px'}}>{song.name}</li>
          )}
        </ul>
      </div>
    );
  }
}

class Song extends Component {
  render() { return (
    <div className="queue_song">
      <img style={{display: "inline-block"}} src={this.props.track.album.images[0].url}/>
      <p style={{display: "inline-block", textOverflow: "ellipsis", width: "250px"}}>
        {this.props.track.name}
        <br/>
        {this.props.track.artists[0].name}
      </p>
      <div onClick={() => {
        if(this.props.connected) {
          this.props.vote(this.props.track)
          console.log("voting for: " + this.props.track.name)
        }
      }}>
        Vote
      </div>
    </div>
  )}
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      playlistSearch: '',
      connectCode: undefined,
      venueName: undefined,
      recentlyPlayed : [],
      recentlyPlayedSearch : '',
      searchResults : []
    }
  }
  componentDidMount() {
    let parsed = queryString.parse(window.location.search);
    let accessToken = parsed.access_token;
    this.setState({"accessToken" : accessToken})
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
          songs: item.trackDatas
        }
    })
    }))

    fetch('https://api.spotify.com/v1/me/player/recently-played?type=track&limit=10', {
      headers: {'Authorization': 'Bearer ' + accessToken}
    })
    .then(function(response) {
      if(response.status === 200) {
        return response.json()
      } else {
        throw new Error("Could not get recently played songs")
      }
    })
    .then(response => {
      this.setState({
        recentlyPlayed : response.items.map(item => item.track)
      })
    })

    console.log("why isn't this being run on the sign in screen?")
    socket.on('updatedQueue', queue => {
      this.setState({
        queue : queue
      })
    })
  }
  nextTrack() {
    var _this = this;
    var bestTrack;
    fetch(backEndUrl + '/queue?' +
    querystring.stringify({
      connectCode : this.state.connectCode
    }), {
      method : "GET"
    })
    .then(response => {
      return response.json();
    })
    .then(response => {
      let tracks = response;
      bestTrack = {
        numVotes : -1,
        isDummy : true
      }
      for(let i=0; i<tracks.length; i++) {
        let track = tracks[i];
        if((!track.wasPlayed) && track.numVotes > bestTrack.numVotes) {
          bestTrack = track;
        }
      }
      if(bestTrack.isDummy) {
        bestTrack = this.state.recentlyPlayed[5]; // kind of arbitrary, but whatever
      }
    })
    .then(() => {
      fetch('https://api.spotify.com/v1/me/player/play' +
      (_this.state.device_id ? "?" + querystring.stringify({"device_id" : _this.state.device_id}) : ""), {
        method : "PUT",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _this.state.accessToken
        },
        body : JSON.stringify({"uris": [bestTrack.uri]})
      })
      .then(response => {
        if(response.status === 204) {
          console.log("Playing: " + bestTrack.name)
          _this.setState({
            current_track : bestTrack
          })
        } else {
          _this.setState({
            current_track : undefined
          })
          throw new Error("Failed to play song"); // don't setPlayed
        }
      })
    })
    .then(() => {
      fetch(backEndUrl + '/setPlayed', {
        method : "PUT",
        headers : {
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body : JSON.stringify({
          connectCode : _this.state.connectCode,
          hostCode : _this.state.hostCode,
          track : bestTrack
        })
      })
    })
  }
  connectToWebPlayer() {
    var _this = this;
    let connectFunction = () => {
      console.log("connecting to Spotify Web Playback SDK")
      const player = new window.Spotify.Player({
        name: 'The Queue Player',
        getOAuthToken: cb => { cb(_this.state.accessToken); }
      });
      player.addListener('ready', ({ device_id }) => {
          _this.setState({
          "device_id" : device_id
        })
        console.log('Ready with Device ID', device_id);
        _this.nextTrack.bind(_this);
        _this.nextTrack()
      });
      player.addListener('player_state_changed', state => {
        console.log(state);
        if(!state) {
          return;
        }
        if(_this.state.current_track === undefined
            || state.track_window.current_track.uri !== _this.state.current_track.uri
            || (state.paused && _this.state.isPlaying)) {
              _this.nextTrack();
        }
        _this.setState({
          isPlaying : !state.paused
        })
      });
      player.connect()
      .then(success => {
        if(success) {
          console.log("connected to web playback")
        } else {
          console.log("failed to connect to web playback")
        }
      })
      _this.setState({
        webPlayer : player
      })
    }
    if(window.Spotify) {
      connectFunction();
    } else {
      console.log("waiting for Spotify script to load")
      window.onSpotifyWebPlaybackSDKReady = connectFunction;
    }
  }
  vote(track) {
    fetch(backEndUrl + '/vote', {
      method : "PUT",
      headers : {
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body : JSON.stringify({
        "connectCode" : this.state.connectCode,
        "access_token" : this.state.accessToken,
        "track" : track
      })
    })
  }
  searchSpotify(text) {
    let _this = this
    if(text !== '') {
      fetch('https://api.spotify.com/v1/search?' +
        querystring.stringify({
          q : text,
          type : "track",
          limit : "10"
        }), {
        headers: {'Authorization': 'Bearer ' + _this.state.accessToken}
      })
      .then(function(response) {
        if(response.status === 200) {
          return response.json()
        } else {
          throw new Error("Could not search Spotify")
        }
      })
      .then(response => {
        _this.setState({
          searchResults : response.tracks.items
        })
      })
    } else {
      _this.setState({
        searchResults : []
      })
    }
  }
  render() {
    let playlistToRender = 
      this.state.user && 
      this.state.playlists 
        ? this.state.playlists.filter(playlist => {
          let matchesPlaylist = playlist.name.toLowerCase().includes(
            this.state.playlistSearch.toLowerCase()) 
          let matchesSong = playlist.songs.find(song => song.name.toLowerCase()
            .includes(this.state.playlistSearch.toLowerCase()))
          return matchesPlaylist || matchesSong
        }) : []
    let recentlyPlayedToRender = 
      this.state.user &&
      this.state.recentlyPlayed.filter(track =>
        track.name.toLowerCase().includes(
          this.state.recentlyPlayedSearch.toLowerCase()
        )
      )
    let queueToRender = 
      this.state.queue &&
      this.state.queue
        .filter(t => !t.wasPlayed)
        .sort((t1, t2) => t2.numVotes - t1.numVotes)
        .slice(0, 10)
    return (
      <div className="App">
        <div style={{display: "block"}}>
          <img className="logo" src="Logo.png" alt="couldn't load Logo.png"
            style={{marginBlockStart: "0.67em",
              /*marginBlockEnd: "0.67em"*/}}/>
          <h1 className="title" style={{backgroundColor: "rgba(255, 40, 40, 0.658)"}}>The Queue</h1>
          {this.state.user && <h1 className="title" style={{backgroundColor: "rgba(97, 97, 97, 0.548)"}}>Signed in as: {this.state.user.name}.</h1>}
          {this.state.connectCode && <div style={{display: "inline-block"}}>
            <h2 className="title" style={{backgroundColor: "rgba(255, 40, 40, 0.658)"}}>Connected To: {this.state.venueName}</h2>
            <h1 className="title" style={{backgroundColor: "rgba(97, 97, 97, 0.548)"}}>Party Code: {this.state.connectCode}</h1>
            <div className="title" style={{backgroundColor: "rgba(255, 40, 40, 0.658)"}} onClick={() => {
              socket.emit('leave', this.state.connectCode)
              this.setState({
                connectCode: undefined,
                hostCode : undefined,
                venueName: undefined,
                queue: [],
                current_track: undefined
              })
              if(this.state.webPlayer) {
                this.state.webPlayer.disconnect();
              }
            }}
            /*style={{padding: '20px', 'fontSize': '50px', 'marginTop': '20px'}}*/>Exit Party</div>
          </div>}
        </div>

        {!this.state.user ?
          <div>
            <button onClick={() => {
                window.location = backEndUrl + '/login'}}
                style={{padding: '20px', 'fontSize': '50px', 'marginTop': '20px'}}>
              Sign in with Spotify
            </button>
          </div>
        :
          <div>
            {!this.state.connectCode ?
              <div>
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
                      hostCode : response.newHostCode,
                      venueName : name,
                      queue : []
                    })
                    console.log("connectCode: " + JSON.stringify(response.newConnectCode))
                    this.connectToWebPlayer()
                    socket.emit('joinVenue', response.newConnectCode)
                  })
                }}
                style={{padding: '20px', 'fontSize': '50px', 'marginTop': '20px'}}>Create</button>
                <button onClick={() => {
                  let connectCode = prompt("Enter connectCode: ");
                  fetch(backEndUrl + '/join?' +
                  querystring.stringify({
                    "connectCode" : connectCode
                  }), {
                    method : "GET"
                  })
                  .then(function(response) {
                    if(response.status === 200) {
                      return response.json()
                    } else {
                      throw new Error("Failed to join veneue")
                    }
                  })
                  .then(response => {
                    let venueName = response.venueName
                    this.setState({
                      connectCode : connectCode,
                      venueName : venueName,
                      queue : []
                    })
                    console.log("Connected to: " + venueName)
                    socket.emit('joinVenue', connectCode)
                  })
                  }
                }
                style={{padding: '20px', 'fontSize': '50px', 'marginTop': '20px'}}>Join</button>
              </div>
            :
              <div style={{width: "100%"}}>
                <div style={{display: "inline-block", verticalAlign: "top", width: "550px"}}>
                  <h1 className="title" style={{backgroundColor: "rgba(255, 40, 40, 0.658)", display: "block", width: "400px"}}>Search:</h1>
                  <Filter onTextChange={text => {
                    this.searchSpotify(text)
                  }}/>
                  {this.state.searchResults.map(track => 
                    <Song track={track} connected={this.state.connectCode !== undefined} vote={t => this.vote(t)}/>
                  )}
                </div>
                <div style={{display: "inline-block", verticalAlign: "top", width: "550px"}}>
                  <h1 className="title" style={{backgroundColor: "rgba(97, 97, 97, 0.548)", display: "block", width: "400px"}}>Queue:</h1>
                  {queueToRender.map(track =>
                    <Song track={track} connected={this.state.connectCode !== undefined} vote={t => this.vote(t)}/>
                  )}
                </div>
              </div>
            }
          </div>
        }
        {this.state.current_track && <div><div style={{minHeight: "50px"}}></div><footer>
          <div className="queue_song">
            <img style={{display: "inline-block"}} src={this.state.current_track.album.images[0].url}/>
            <p style={{display: "inline-block", textOverflow: "ellipsis", width: "250px"}}>
              {this.state.current_track.name}
              <br/>
              {this.state.current_track.artists[0].name}
            </p>
            {this.state.isPlaying === true &&
              <div onClick={() => {
                if(!this.state.hostCode) {
                  console.log("Only the host can pause the song.")
                  return;
                }
                fetch('https://api.spotify.com/v1/me/player/pause' +
                (this.state.device_id ? "?" + querystring.stringify({"device_id" : this.state.device_id}) : ""), {
                  method : "PUT",
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.state.accessToken
                  }
                })
                .then(response => {
                  if(response.status === 204) {
                    this.setState({
                      isPlaying : false
                    })
                  } else {
                    throw new Error("failed to pause song")
                  }
                })
              }}>Pause</div>
            }
            {this.state.isPlaying === false &&
              <div onClick={() => {
                if(!this.state.hostCode) {
                  console.log("Only the host can resume the song.")
                  return;
                }
                fetch('https://api.spotify.com/v1/me/player/play' +
                (this.state.device_id ? "?" + querystring.stringify({"device_id" : this.state.device_id}) : ""), {
                  method : "PUT",
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.state.accessToken
                  }
                })
                .then(response => {
                  if(response.status ===204) {
                    this.setState({
                      isPlaying : true
                    })
                  } else {
                    throw new Error("failed to resume song")
                  }
                })
              }}>Play</div>
            }
            {this.state.connectCode && <div>
              {this.state.device_id ? 
                <div onClick={() => {
                  if(!this.state.hostCode) {
                    console.log("Only the host can skip to the next song.")
                    return;
                  }
                  this.nextTrack.bind(this);
                  this.nextTrack()
                }}>Next</div>
              : <div>Connecting to web player</div>
              }
            </div>}
          </div>
        </footer></div>}
      </div>
    );
  }
}

export default App;
