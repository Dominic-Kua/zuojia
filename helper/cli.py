#!/usr/bin/env python3
import sys
import argparse
import requests

DEFAULT_PORT = 5178

parser = argparse.ArgumentParser(description='ä½å®¶ helper CLI')
parser.add_argument('command', choices=['snapshot','export','health'], help='command')
parser.add_argument('--port', type=int, default=DEFAULT_PORT)
parser.add_argument('--message', type=str, default='autosnapshot')
parser.add_argument('--path', type=str, default='')

args = parser.parse_args()
base = f'http://127.0.0.1:{args.port}'

if args.command == 'health':
    r = requests.get(base + '/health')
    print(r.json())
elif args.command == 'snapshot':
    data = {'message': args.message, 'path': args.path}
    r = requests.post(base + '/snapshot', json=data)
    print(r.json())
elif args.command == 'export':
    data = {'repo_path': args.path}
    r = requests.post(base + '/export', json=data)
    print(r.json())
