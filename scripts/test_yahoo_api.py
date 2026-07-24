#!/usr/bin/env python3
"""Test Yahoo Fantasy API guardrail - fetch league settings."""
import json
import os
import urllib.request
import urllib.error

AUTH_PATH = os.path.join(os.path.expanduser("~"), "AppData", "Local", "hermes", "auth.json")


def load_yahoo_tokens(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for section in [data.get("providers", {}), data.get("credential_pool", {})]:
        for name, entry in section.items():
            if isinstance(entry, dict) and "access_token" in entry:
                return entry
            if isinstance(entry, list):
                for e in entry:
                    if isinstance(e, dict) and "access_token" in e:
                        return e
    return None


def yahoo_fetch(token, endpoint):
    url = "https://fantasysports.yahooapis.com/fantasy/v2/" + endpoint + "?format=json"
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token["access_token"],
        "User-Agent": "PocketBeane/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {"_http_error": exc.code, "_body": exc.read().decode("utf-8", errors="replace")}
    except Exception as exc:
        return {"_exception": str(exc)}


def get_leagues(data):
    leagues = []
    try:
        users = data["fantasy_content"]["users"]
        user_list = users["0"]["user"]
        if len(user_list) < 2:
            return leagues
        games = user_list[1]["games"]
        game_count = int(games["count"])
        for i in range(game_count):
            gi = str(i)
            game_arr = games[gi]["game"]
            if len(game_arr) < 2:
                continue
            meta = game_arr[0]
            if meta.get("is_offseason") == 1:
                continue
            teams = game_arr[1].get("teams", {})
            for j in range(int(teams.get("count", 0))):
                team_arr = teams[str(j)]["team"]
                items = team_arr[0] if isinstance(team_arr[0], list) else []
                for item in items:
                    if "team_key" in item:
                        parts = item["team_key"].split(".")
                        if len(parts) >= 4 and parts[1] == "l":
                            leagues.append({"key": parts[0] + ".l." + parts[2], "game_code": meta.get("code")})
    except Exception as exc:
        print("Parse error:", exc)
    return leagues


def get_settings(token, lk):
    result = yahoo_fetch(token, "league/" + lk + "/settings")
    if "_http_error" in result:
        return None, None
    try:
        arr = result["fantasy_content"]["league"]
        cw = arr[0].get("current_week") if len(arr) > 0 else None
        ps = None
        if len(arr) > 1:
            sarr = arr[1].get("settings", [{}])
            if isinstance(sarr, list) and len(sarr) > 0:
                ps = sarr[0].get("playoff_start_week")
        return cw, ps
    except Exception:
        return None, None


def main():
    print("Yahoo Fantasy API guardrail test")
    print("Auth path:", AUTH_PATH)
    token = load_yahoo_tokens(AUTH_PATH)
    if not token:
        print("ERROR: No Yahoo token found.")
        return False

    print("Found token (type: " + token.get("auth_type", "?") + ")")

    print()
    print("Fetching teams...")
    result = yahoo_fetch(token, "users;use_login=1/games;game_codes=mlb,nba,nhl,nfl/teams")
    if "_http_error" in result:
        print("Fetch failed:", result["_http_error"])
        return False

    leagues = get_leagues(result)
    if not leagues:
        print("No active leagues found (offseason). Trying all games...")
        result = yahoo_fetch(token, "users;use_login=1/teams")
        leagues = get_leagues(result)

    print("Found " + str(len(leagues)) + " league(s):")
    ok = True
    for l in leagues:
        print()
        print("  League " + l["key"] + " (" + l.get("game_code", "?") + "):")
        cw, ps = get_settings(token, l["key"])
        print("    current_week=" + str(cw))
        print("    playoff_start_week=" + str(ps))
        if cw is not None and ps is not None:
            print("    OK")
        else:
            print("    PARTIAL")
            ok = False

    if ok and leagues:
        print()
        print("PASSED: current_week and playoff_start_week returned for all connected leagues.")
    else:
        print()
        print("FAILED: Some data missing.")
    return ok


if __name__ == "__main__":
    exit(0 if main() else 2)
