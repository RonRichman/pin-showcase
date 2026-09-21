#!/usr/bin/env python3
"""Export public aggregates from the authors' saved PINs; never train or publish rows."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
import argparse
import hashlib
import math
import json
from pathlib import Path
import subprocess
import time
import zipfile
import numpy as np
import h5py

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'sources/private'
SOURCE = PRIVATE / 'Example v11 - GitHub'
FEATURES = ['Area', 'VehPower', 'VehAge', 'DrivAge', 'BonusMalus', 'VehGas', 'Density', 'VehBrand', 'Region']
LABELS = ['Area', 'Vehicle power', 'Vehicle age', 'Driver age', 'Bonus–malus', 'Fuel type', 'Density', 'Vehicle brand', 'Region']
PAIRS = [(i,j) for i in range(9) for j in range(i,9)]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def prepare(rscript):
    """Execute the exact R transformations, including factor levels and R rounding."""
    program = r'''
args <- commandArgs(trailingOnly=TRUE)
load(file.path(args[1], 'freMTPL2freqClean.rda'))
d <- freMTPL2freqClean
features <- c('Area','VehPower','VehAge','DrivAge','BonusMalus','VehGas','Density','VehBrand','Region')
raw <- sapply(d[,features], as.numeric)
d$VehAge <- pmin(d$VehAge,20)
d$DrivAge <- pmin(d$DrivAge,90)
d$BonusMalus <- pmin(d$BonusMalus,150)
d$Density <- round(log(d$Density),2)
x <- raw
stats <- matrix(NA,9,2,dimnames=list(features,c('mean','sd')))
for (j in c(1:5,7)) {
    z <- as.numeric(d[[features[j]]])
    stats[j,] <- c(mean(z),sd(z))
    x[,j] <- (z-mean(z))/sd(z)
}
for (j in c(6,8,9)) x[,j] <- raw[,j]-1
out <- cbind(x,raw,d$Exposure,d$ClaimNb,as.numeric(d$LearnTest=='L'))
con <- file(file.path(args[2],'prepared.bin'),'wb')
writeBin(as.double(t(out)),con,size=8,endian='little');close(con)
write.csv(stats,file.path(args[2],'stats.csv'))
writeLines(c(paste(levels(d$Area),collapse=','),paste(levels(d$VehGas),collapse=','),paste(levels(d$VehBrand),collapse=','),paste(levels(d$Region),collapse=',')),file.path(args[2],'levels.txt'))
'''
    subprocess.run([rscript, '-e', program, str(SOURCE), str(PRIVATE)], check=True)
    data = np.fromfile(PRIVATE/'prepared.bin', dtype='<f8').reshape(-1,21)
    stats = np.genfromtxt(PRIVATE/'stats.csv', delimiter=',', skip_header=1, usecols=(1,2))
    levels = [line.split(',') for line in (PRIVATE/'levels.txt').read_text().splitlines()]
    return data, stats, levels

class PIN:
    def __init__(self, path):
        with h5py.File(path) as f:
            base = '_layer_checkpoint_dependencies\\'
            def dense(name, prefix=base):
                return tuple(np.asarray(f[prefix+name+'/vars/'+str(i)],dtype=np.float64) for i in (0,1))
            def name(k): return 'dense'+('_'+str(k) if k else '')
            self.embeddings = [(dense(name(2*i)),dense(name(14+2*i))) for i in range(7)]
            self.brand = np.array(f[base+'embedding/vars/0'],dtype=float)
            self.region = np.array(f[base+'embedding_2/vars/0'],dtype=float)
            self.tokens = np.array(f[base+'pairwise_interaction_layer/vars/0'],dtype=float)
            shared = base+'pairwise_interaction_layer\\interaction_network\\_layer_checkpoint_dependencies\\'
            self.network = [dense(name(i),shared) for i in (0,2,4)]
            self.output, bias = dense('dense_28')
            self.output = self.output[:,0]
            self.bias = float(bias[0])
        self.path = path
    def embed(self, x):
        es = [np.tanh((x[:,i:i+1]@w1+b1)@w2+b2) for i,((w1,b1),(w2,b2)) in enumerate(self.embeddings)]
        es += [self.brand[x[:,7].astype(int)], self.region[x[:,8].astype(int)]]
        return es
    def contributions(self,x, selected=None):
        es = self.embed(x)
        (w1,b1),(w2,b2),(w3,b3) = self.network
        left = [e@w1[:10] for e in es]
        right = [e@w1[10:20] for e in es]
        indices = range(45) if selected is None else selected
        out = []
        for k in indices:
            i,j = PAIRS[k]
            h = np.maximum(left[i]+right[j]+self.tokens[k]@w1[20:]+b1,0)
            h = np.maximum(h@w2+b2,0)
            g = np.clip((1+(h@w3+b3)[:,0])/2,0,1)
            out.append(g*self.output[k])
        return np.column_stack(out)
    def log_predict(self,x):
        return self.bias+self.contributions(x).sum(axis=1)
    def predict(self,x,batch=8192):
        out = np.empty(len(x))
        for start in range(0,len(x),batch): out[start:start+batch] = np.exp(self.log_predict(x[start:start+batch]))
        return out
    def tf_check(self,x):
        import tensorflow as tf
        tf.config.threading.set_intra_op_parallelism_threads(1)
        tf.config.threading.set_inter_op_parallelism_threads(1)
        es=[]
        for i,((w1,b1),(w2,b2)) in enumerate(self.embeddings):
            e=tf.constant(x[:,i:i+1],dtype=tf.float32)
            e=tf.matmul(e,w1.astype('float32'))+b1.astype('float32')
            e=tf.math.tanh(tf.matmul(e,w2.astype('float32'))+b2.astype('float32'))
            es.append(e)
        es += [tf.constant(self.brand[x[:,7].astype(int)],tf.float32),tf.constant(self.region[x[:,8].astype(int)],tf.float32)]
        outputs=[]
        for k,(i,j) in enumerate(PAIRS):
            h=tf.concat([es[i],es[j],tf.broadcast_to(tf.constant(self.tokens[k],tf.float32),(len(x),10))],axis=1)
            for n,(w,b) in enumerate(self.network):
                h=tf.matmul(h,w.astype('float32'))+b.astype('float32')
                if n<2:h=tf.nn.relu(h)
            outputs.append(tf.clip_by_value((1+h)/2,0,1))
        f=tf.exp(tf.matmul(tf.concat(outputs,axis=1),self.output[:,None].astype('float32'))+self.bias).numpy()[:,0]
        n=np.exp(self.log_predict(x))
        return {'engine':'TensorFlow float32 explicit concatenation and original layer order vs NumPy float64 factored first layer','rows':len(x),'maxAbsoluteFrequencyError':float(np.max(np.abs(f-n))),'maxRelativeFrequencyError':float(np.max(np.abs(f-n)/n))}

def deviance(pred,y):
    terms = pred-y
    positive=y>0
    terms[positive]+=y[positive]*np.log(y[positive]/pred[positive])
    return float(200*terms.mean())

def encode(raw, stats):
    x=np.array(raw, dtype=float, copy=True)
    if x.ndim==1:x=x[None,:]
    for j,cap in ((2,20),(3,90),(4,150)):x[:,j]=np.minimum(x[:,j],cap)
    x[:,6]=np.round(np.log(x[:,6]),2)
    for j in (0,1,2,3,4,6):x[:,j]=(x[:,j]-stats[j,0])/stats[j,1]
    for j in (5,7,8):x[:,j]-=1
    return x

def shap(model, profile, bg):
    """Opposite permutations give exact empirical interventional SHAP for order <=2."""
    def path(order):
        data=bg.copy();prev=model.log_predict(data).mean();result=np.zeros(9)
        for i in order:
            data[:,i]=profile[i]
            nxt=model.log_predict(data).mean();result[i]=nxt-prev;prev=nxt
        return result
    return (path(range(9))+path(range(8,-1,-1)))/2

def subset_shap_check(model, profile, bg):
    """Independent all-coalition enumeration checks the reverse-permutation shortcut."""
    designs=[]
    for mask in range(512):
        z=bg.copy()
        for j in range(9):
            if mask & (1<<j):z[:,j]=profile[j]
        designs.append(z)
    joined=np.concatenate(designs)
    prediction=np.empty(len(joined))
    for start in range(0,len(joined),8192):
        prediction[start:start+8192]=model.log_predict(joined[start:start+8192])
    game=prediction.reshape(512,len(bg)).mean(axis=1)
    result=np.zeros(9)
    for j in range(9):
        for mask in range(512):
            if not mask & (1<<j):
                k=mask.bit_count()
                result[j]+=(game[mask|(1<<j)]-game[mask])/(9*math.comb(8,k))
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archive',type=Path,default=Path('/tmp/pin-public-example-v11.zip'));parser.add_argument('--rscript',default='/home/ron/miniconda3/bin/Rscript');parser.add_argument('--models',type=int,default=10);args=parser.parse_args()
    PRIVATE.mkdir(parents=True,exist_ok=True)
    if not SOURCE.exists():
        with zipfile.ZipFile(args.archive) as z:z.extractall(PRIVATE)
    data,stats,levels=prepare(args.rscript)
    x=data[:,:9];raw=data[:,9:18];exposure=data[:,18];y=data[:,19];learn=data[:,20]==1;test=~learn
    print('Prepared',len(data),'rows; test',test.sum(),flush=True)
    results=[];ensemble=np.zeros(test.sum());start=time.monotonic()
    for seed in range(100,100+args.models):
        model=PIN(SOURCE/f'Networks/PIN_Diag{seed}.weights.h5')
        freq=model.predict(x[test]);pred=freq*exposure[test];ensemble+=pred/args.models
        result={'seed':seed,'testDeviance':deviance(pred,y[test]),'sha256':sha(model.path)};results.append(result)
        print(result,'elapsed',round(time.monotonic()-start,1),flush=True)
    model=PIN(SOURCE/'Networks/PIN_Diag100.weights.h5')
    check=model.tf_check(x[test][:512]);assert check['maxRelativeFrequencyError']<1e-4
    rng=np.random.default_rng(20260921);bg=x[rng.choice(np.flatnonzero(learn),256,replace=False)]
    baseline=float(model.log_predict(bg).mean())
    # The common settings are constructed values, not a selected policy row.
    # Area C, power 6, age 5, driver 45, BM 50, Diesel, density 300, B1, R24.
    region=levels[3].index('R24')+1
    common=np.array([3,6,5,45,50,1,300,1,region],dtype=float)
    specs=[('established','Established driver','Age 45 · bonus–malus 50 · density 300/km²',{}),('young','Young driver','Age 22 · bonus–malus 100 · density 300/km²',{3:22,4:100}),('urban','Urban setting','Age 45 · bonus–malus 50 · density 5,000/km²',{6:5000}),('higher-bonus-malus','Higher bonus–malus','Age 45 · bonus–malus 100 · density 300/km²',{4:100})]
    profiles=[];residuals=[];subset_errors=[]
    for id,label,description,changes in specs:
        r=common.copy()
        for j,v in changes.items():r[j]=v
        p=encode(r,stats)[0];values=shap(model,p,bg);log=float(model.log_predict(p[None,:])[0]);residual=abs(baseline+values.sum()-log);residuals.append(residual)
        subset_errors.append(float(np.max(np.abs(values-subset_shap_check(model,p,bg)))))
        profiles.append({'id':id,'label':label,'description':description,'frequency':float(np.exp(log)),'baselineLog':baseline,'contributions':[{'feature':name,'value':float(v)} for name,v in zip(LABELS,values)],'logPrediction':log,'constructedInputs':dict(zip(FEATURES,r.tolist()))})
    assert max(residuals)<1e-10
    assert max(subset_errors)<1e-10
    grids=[('age-bonus','Driver age × Bonus–malus',3,4,np.linspace(18,90,37),np.linspace(50,150,41)),('age-density','Driver age × Density',3,6,np.linspace(18,90,37),np.geomspace(1,27000,41)),('vehicle-age-power','Vehicle age × Vehicle power',2,1,np.arange(0,21),np.arange(4,16))]
    pairs=[]
    for id,label,i,j,xv,yv in grids:
        xx,yy=np.meshgrid(xv,yv);points=np.tile(common,(xx.size,1));points[:,i]=xx.ravel();points[:,j]=yy.ravel();k=PAIRS.index(tuple(sorted((i,j))))
        v=model.contributions(encode(points,stats),[k])[:,0].reshape(xx.shape)
        def edges(a,log=False):
            a=np.log(a) if log else a;m=(a[:-1]+a[1:])/2;e=np.r_[-np.inf,m,np.inf];return np.exp(e) if log else e
        support=np.histogram2d(raw[learn,i],raw[learn,j],bins=(edges(xv),edges(yv,j==6)))[0].T.astype(int)
        pairs.append({'id':id,'label':label,'xLabel':LABELS[i]+(' (years)' if i in (2,3) else ''),'yLabel':LABELS[j]+(' (people/km²)' if j==6 else ''),'xValues':xv.tolist(),'yValues':yv.tolist(),'values':v.tolist(),'support':support.tolist(),'supportMask':(support>=20).tolist(),'supportThreshold':20,'ySpacing':'log' if j==6 else 'linear','scale':'weighted contribution to log frequency','description':'One uncentred fitted pair term, including its output weight; not the total prediction or a causal effect. Shading marks fewer than 20 training records in the surrounding grid cell.','pairIndex':k})
    validation={'testRows':int(test.sum()),'learningRows':int(learn.sum()),'totalRows':len(data),'testDeviance':results[0]['testDeviance'],'ensembleTestDeviance':deviance(ensemble,y[test]),'individualModels':results,'devianceDefinition':'100 × mean Poisson deviance per policy record; predicted claims = annual frequency × exposure','tensorflowCrossCheck':check,'shapBackgroundRows':len(bg),'shapBackgroundSeed':20260921,'maxShapAdditivityError':max(residuals),'maxShapAll512CoalitionsError':max(subset_errors),'shapCoalitionValidationProfiles':len(profiles),'sourceFitScriptSha256':sha(SOURCE/'01_a PIN - fit networks.r'),'sourceShapScriptSha256':sha(SOURCE/'01_b PIN - SHAP on pre-fitted networks.r'),'sourceDataSha256':sha(SOURCE/'freMTPL2freqClean.rda'),'archiveSha256':sha(args.archive),'trainingPerformed':False,'status':'verified repository saved-weight inference; not an independent reproduction of the R2 benchmark'}
    out={'status':'verified','source':{'repository':'https://github.com/wueth/Tree-Like-PIN','archive':'Example v11 - GitHub.zip','scriptVersion':'August 2025','sha256':sha(args.archive),'scope':'Public repository saved model demonstration. The numeric embedding in this code uses Dense(20, linear) → Dense(10, tanh); this differs from the R2 manuscript specification. Do not equate these rerun scores with the published benchmark.'},'model':{'name':'PIN_Diag100','seed':100,'features':9,'pairTerms':45,'architecture':'7 scalar embeddings: 1→20 linear→10 tanh; categorical embeddings 11×10 and 22×10; 45 tokens of dimension 10; shared 30→30 ReLU→20 ReLU→1 hard sigmoid; weighted exponential output','profileScope':'Constructed profiles, exposure 1 year, single saved model; demonstration only','shapMethod':'Interventional SHAP on log annual frequency, exact for the 256-record empirical background via a forward/reverse permutation pair; marginal background may create uncommon feature combinations.'},'validation':validation,'pairs':pairs,'profiles':profiles,'featureNames':LABELS}
    (ROOT/'site/data').mkdir(parents=True,exist_ok=True)
    serialized=json.dumps(out,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    (ROOT/'site/data/model-exhibits.json').write_text(serialized+'\n')
    (ROOT/'site/data/model-exhibits.js').write_text('window.PIN_MODEL = '+serialized+';\n')
    (ROOT/'verification/model-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
    print(json.dumps(validation,indent=2),flush=True)

if __name__=='__main__':main()
