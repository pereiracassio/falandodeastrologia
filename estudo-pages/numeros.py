import subprocess,json,re,sys
pdf=sys.argv[1]
blocos=json.load(open('conteudo.json'))
caps=[''.join(r['t'] for r in b['runs']) for b in blocos if b['k']=='h' and b['level']==2]
n=int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',pdf],capture_output=True,text=True).stdout).group(1))
pages=[re.sub(r'\s+',' ',subprocess.run(['pdftotext','-f',str(i),'-l',str(i),pdf,'-'],capture_output=True,text=True).stdout) for i in range(1,n+1)]
nums=[]
for c in caps:
    alvo=re.sub(r'\s+',' ',c).upper()
    f=None
    for i,p in enumerate(pages):
        if i<2: continue
        if alvo in p: f=i+1; break
    nums.append(f if f else None)
print(list(zip(caps,nums)))
assert all(nums), 'faltou capítulo'
json.dump(nums,open('numeros.json','w'))
