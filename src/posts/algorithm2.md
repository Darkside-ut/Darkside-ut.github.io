---
title: Topic 2
date: 2026-10-09
tags: [算法基础]
summary: 渐近记号、标准记号与常用函数以及递归式求解
---

# 一、渐近记号

## 1. 三种基本记号

| 记号 | 含义 | 集合定义（$\exists c > 0,\ n_0 > 0$，$\forall n \ge n_0$） |
|:----:|:----:|:----------------------------------------------------------:|
| $O$ | 渐近上界 | $0 \le f(n) \le c \cdot g(n)$ |
| $\Omega$ | 渐近下界 | $0 \le c \cdot g(n) \le f(n)$ |
| $\Theta$ | 渐近紧确界 | $c_1 g(n) \le f(n) \le c_2 g(n),\ c_1 > 0,\ c_2 > 0$ |

对应集合的定义：

$$O(g(n)) = \{f(n) : \exists c > 0, n_0 > 0, \forall n \ge n_0, 0 \le f(n) \le cg(n)\}$$
因此，可以简记为：$f(n) \in O(g(n))$
> 公式中的集合代表某个属于该集合的匿名函数

<p align="center">
  <img src="/devices/1.png" alt="三种渐进符号的图示">
  <br>
  <small>figure 1：三种渐进符号的图示</small>
</p>

## 2. 其他渐近记号

- $o$-notation：非紧确上界（$f(n) = o(g(n))$ 当 $f(n)$ 增长严格慢于 $g(n)$）。
- $\omega$-notation：非紧确下界（$f(n) = \omega(g(n))$ 当 $f(n)$ 增长严格快于 $g(n)$）。

> 严格慢于：$f(n) = o(g(n)) \iff \lim_{n \to \infty} \frac{f(n)}{g(n)} = 0$
>
>严格快于：$f(n) = \omega(g(n)) \iff \lim_{n \to \infty} \frac{f(n)}{g(n)} = \infty$

<p align="center">
  <img src="/devices/2.png" alt="A Helpful Analogy">
  <br>
  <small>figure 2：A Helpful Analogy</small>
</p>

## 3. 性质

- **传递性**：$f = \Theta(g)$ 且 $g = \Theta(h) \Rightarrow f = \Theta(h)$；对 $O, \Omega, o, \omega$ 同理
- **自反性**：$f = \Theta(f)$，$f = O(f)$，$f = \Omega(f)$。
- **对称性**：$f = \Theta(g) \iff g = \Theta(f)$
- **转置对称性**：$f = O(g) \iff g = \Omega(f)$；$f = o(g) \iff g = \omega(f)$
- **非完全性**：并非任意两个函数都可比较（例如 $n$ 与 $n^{1-\sin(n\pi/2)}$）

> 非完全性：两个函数的大小关系会随着 $n$ 的增大不断来回摆动，无法确定谁最终更大，此时无法比较这两个函数

# 二、常用记号与函数

## 1. 向下取整Floor与向上取整Ceiling
- $\lfloor x \rfloor$：不大于$x$的最大整数；$\lceil x \rceil$：不小于$x$的最小整数
- 核心不等式：$x-1<\lfloor x \rfloor \le x \le \lceil x \rceil \le x+1$
- 恒等式：
  1. 对整数$n$：$\lceil n/2 \rceil+\lfloor n/2 \rfloor = n$
  2. 嵌套取整：$\left\lceil \frac{\lceil x/a\rceil}{b} \right\rceil=\left\lceil \frac{x}{ab} \right\rceil,\ \left\lfloor \frac{\lfloor x/a\rfloor}{b} \right\rfloor=\left\lfloor \frac{x}{ab} \right\rfloor$

## 2. 模运算 Modular Arithmetic
- $a \bmod n = a-n\lfloor a/n \rfloor$，是 $a$ 除以 $n$ 的余数
- 同余记号：$a\equiv b \pmod n$，等价于 $n$ 整除 $a-b$，也等价于 $a\bmod n = b\bmod n$

## 3. 指数 Exponentials
- 幂运算基本性质：$a^0=1,\;(a^m)^n=a^{mn},\;a^m a^n=a^{m+n}$
- 若 $a>1$，多项式增长远慢于指数：$n^b=o(a^n)$
- 自然指数泰勒展开：$\displaystyle e^x=\sum_{k=0}^{\infty}\frac{x^k}{k!}$；$x\to 0$ 时有 $e^x=1+x+\Theta(x^2)$

## 4. 对数 Logarithms
**记号约定：**
- $\lg n=\log_2 n$（以2为底），$\ln n=\log_e n$（自然对数）；
- $\lg^k n=(\lg n)^k$，$\lg\lg n=\lg(\lg n)$

**性质：**
- 换底公式：$\displaystyle \log_b x=\frac{\lg x}{\lg b}$；$\log_b(xy)=\log_bx+\log_by$；$\log_b x^r=r\log_b x$
- 多项式碾压对数：任意常数$\alpha>0,\beta\in\mathbb R$，有$\lg^\beta n = o(n^\alpha)$，对数多项式增长慢于任意正次幂多项式
- $\ln(1+x)$ 泰勒展开，不等式：$\frac{x}{x+1}\le \ln(1+x)\le x~(x>-1)$

## 5. 阶乘 Factorials
- 递归定义：$0!=1,\ n!=n\cdot(n-1)!$
- 上界：$n!\le n^n$
- **斯特林 Stirling 近似**：
$$
n!=\sqrt{2\pi n}\left(\frac{n}{e}\right)^n\big(1+\Theta(\tfrac1n)\big)
$$

## 6. 函数迭代 Functional iteration
$f^{(i)}(n)$代表函数迭代$i$次：
$$
f^{(i)}(n)=
\begin{cases}
n &i=0\\
f(f^{(i-1)}(n)) &i>0
\end{cases}
$$
例：$f(n)=2n$，则$f^{(i)}(n)=2^i n$

> 将上一次迭代结果重新作为输入

## 7. 迭代对数 $\lg^* n$
$$\lg^* n=\min\{i\ge 0:\ \lg^{(i)}n \le 1\}$$

例：$\lg^*2=1,\ \lg^*4=2,\ \lg^*16=3,\ \lg^{*}(2^{65536})=5$

> 要迭代取对数直到结果≤1所需要的次数，增长极慢


## 8. 斐波那契 Fibonacci Numbers
递归定义：$F_0=0,\ F_1=1,\ F_i=F_{i-1}+F_{i-2}\ (i\ge2)$，序列：$0~1~1~2~3~5~8\dots$

# 三、递归式求解方法

递归式是把函数用更小输入上的值描述的等式 / 不等式

求解分治算法的时间复杂度通常会得到递归式

## 1. 代入法 Substitution Method
步骤：

1. 猜测解的形式；
2. 用数学归纳法证明猜测成立；
3. 选取常数，验证基础情况。

> 只能用于能猜出解形式的情况；可证明上界或下界

例：$T(n)=4T(n/2)+n$，$T(1)=\Theta(1)$

首先猜测 $T(n)=O(n^3)$

<p align="center">
  <img src="/devices/3.png" alt="第一次猜测">
  <br>
  <small>figure 3：第一次猜测</small>
</p>
但是不难发现，我们的放缩有点过度，这并不能很准确的衡量他的复杂度

技巧：**加强归纳假设，减去低阶项**

因此，我们可以将归纳假设改为 $T(k)\le c_1 k^2-c_2k$，代入递归式，取$c_2\ge1$，可以证出 $T(n)=O(n^2)$。
然后再证明下界 $T(n)=\Omega(n^2)$；综合得到 $T(n)=\Theta(n^2)$。
其中，我们可以选取足够大的 $c_1$ 来使得证明满足边界条件

## 2. 递归树法 Recursion‑tree Method

思想：把递归式展开成一棵树，每一层代表递归调用一层的代价；把每一层代价求和得到总代价，得到猜想

**递归树得到的猜想一般需要再用代入法验证**

例： $T(n)=T(n/4)+T(n/2)+n^2$

<p align="center">
  <img src="/devices/4.png" alt="递归树">
  <br>
  <small>figure 4：递归树</small>
</p>

每次结点分裂都会产生 $n^2$ 的余项

## 3. The Master Method
我们来看更标准的递归式：
$$
 T(n) =aT( \frac{n}{b} )+f(n)
$$
其中 $a≥1$, $b>1$, 且 $f$ 趋于正

它同样可以构建一个递归树，而我们要比较的正好是每次结点分裂得到的余项和叶子结点的量级大小

我们假设递归树的高度为 $h$，每次分裂都会产生 $a$ 个子结点，每次分裂，$n$ 都会被 $b$ 除一次，因此有：
$$
\frac{n}{b^h} = 1
$$

即，$h = \log_b n$

因此，叶子总个数为 $a^h = a^{\log_b n} = n^{\log_b a}$

我们可以分类得到一下三种情况：
| 情况 | 条件核心 | 正则条件要求 | 解 |
|:----:|:---------|:------------:|:---|
| Case 1 | $f(n) = O(n^{\log_b a - \varepsilon}),\ \varepsilon > 0$ | 不需要 | $\Theta(n^{\log_b a})$ |
| Case 2 | $f(n) = \Theta(n^{\log_b a} \lg^k n),\ k \ge 0$ | 不需要 | $\Theta(n^{\log_b a} \lg^{k+1} n)$ |
| Case 3 | $f(n) = \Omega(n^{\log_b a + \varepsilon}),\ \varepsilon > 0$ | 需满足：$\exists\ c < 1$，对足够大 $n$ 有 $a \cdot f\!\left(\frac{n}{b}\right) \le c \cdot f(n)$ | $\Theta(f(n))$ |

- Case1：叶子更大 $\Rightarrow$ 取叶子 $\Theta(n^{\log_b a})$
- Case2：势均力敌 $\Rightarrow$ 基准乘多一次对数
- Case3：根更大 $\Rightarrow$ 直接取 $f(n)$（正则条件）

# 附录：两个几何级数

$$
1 + x + x^2 + \cdots + x^n = \frac{1 - x^{n+1}}{1 - x} \quad \text{for } x \ne 1
$$

$$
1 + x + x^2 + \cdots = \frac{1}{1 - x} \quad \text{for } |x| < 1
$$