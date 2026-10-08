---
title: Topic 1
date: 2026-10-08
tags: [算法基础]
summary: 简单算法复杂度、递推式、算法设计思想以及排序和图等基础算法
---

# 一、典型问题举例

## 1. 两个鸡蛋问题

100 层楼、两个鸡蛋：

- 鸡蛋可能在低楼层就碎
- 也可能从 100 楼掉下来仍不碎
- 要确定最高安全楼层
- 最多允许两个鸡蛋碎

> 如何设计最少测试次数的策略。

## 2. Polynomial Puzzle

给一个黑盒：

$$ p(x) $$

输入 $x$，黑盒返回 $p(x)$，多项式系数都是自然数

**问题：**

如何通过黑盒查询确定多项式的全部系数？

> 算法设计 + 信息获取 + 查询次数优化

## 3. Secretary Problem

有 $n$ 个候选人：

- 候选人随机顺序到达
- 只能知道当前候选人与之前候选人的相对排名
- 拒绝之后不能重新选择
- 目标是选择最优秀的人

> 在线决策 / 概率算法问题

## 4. Candy Problem

给 $n$ 个孩子分糖：

- 每个人至少一颗
- 如果一个孩子评分比邻居高，则必须获得更多糖
- 求最少糖果数量

> 如何同时满足多个局部约束，并使总体最小

## 5. Erect the Fence

给出平面上的树的位置：

$$ (x_i,y_i) $$

要求用最短绳子把所有树围起来

> 计算几何 / 凸包问题

## 6. Maximum Sum Submatrix

给一个：

$$ N\times N $$

的正负整数矩阵

寻找元素和最大的子矩阵

> 暴力方法可能非常慢，需要更好的算法

## 7. 有序数组中找第一次出现位置

数组已经排序：

$$1~2~2~2~3~4~5$$

寻找某个数字第一次出现的位置，要求 sub-linear time，也就是不能简单地从头遍历

> Binary Search（二分查找）

# 二、运行时间分析

运行时间与输入规模、输入具体内容和机器性能都有关系，我们不直接关注某台机器运行了多少秒，而是研究 $n$ 增大时运行时间是如何增长的

## 1. 三种基本复杂度

a. Worst Case

b. Average Case
- 重要假设：输入需要服从某种概率分布

c. Best Case

d. Smoothed Analysis (平滑分析)
- 对于一个具体输入，假设输入受到一些很小的随机扰动，然后研究算法的复杂度

e. Asymptotic Analysis (渐进分析)
- 忽略机器相关的常数，只研究 $n\rightarrow\infty$ 时函数的增长速度，即谁占主导作用，复杂度与谁相关

## 2. 三种符号表示

### <span style="color: #525151">$\Theta$ notation</span>
如果存在正常数 $c_1,c_2$ 和 $n_0$，使：

$$ 0\le c_1g(n)\le f(n)\le c_2g(n) $$

对于 $n\ge n_0$ 都成立，那么：$f(n)=Θ(g(n))$

> 直观上理解，表示同阶增长，也就是说 $f$ 与 $g$ 增速无差
> 
> 图像上来看，就是在一定值以后，$f$ 可以被 $g$ 完全框住

### <span style="color: #525151">$O$ notation</span>
如果存在正常数 $c_2$ 和 $n_0$，使：

$$ f(n)\le c_2g(n) $$

对于 $n\ge n_0$ 成立，那么 $f(n)=O(g(n))$
	​
> $f$ 的上界可被 $g$ 限制

### <span style="color: #525151">$\Omega$ notation</span>
如果：

$$ 0\le c_1g(n)\le f(n) $$

那么 $f(n)=Ω(g(n))$

> $f$ 的下界可被 $g$ 限制

## 3. 常见复杂度增长顺序

$$1 \lt \log n \lt n \lt n\log n \lt n^2 \lt n^3 \lt 2^n \lt n!$$

即：常数、对数、线性、线性对数、平方、立方、指数和阶乘

> 当 $n$ 足够大时，$\Theta(n\log n)$ 最终会优于 $Θ(n^2)$

**我们关注增长趋势，而不是具体机器上的运行时间，因此常数系数一般忽略**

# 三、排序问题

## 1. 定义

输入：

$$ A=\langle a_1,a_2,\dots,a_n\rangle $$

输出：

$$ A'=\langle a'_1,a'_2,\dots,a'_n\rangle $$

输出满足：

$$a'_1\leq a'_2\leq ...\leq a'_n$$

## 2. Insertion Sort（插入排序）

### ① 基本思想

左侧已经排好序，不断将右侧的元素插入左侧序列

### ② 伪代码

```pseudocode InsertionSort(A, n)
for j ← 2 to n
    key ← A[j]
    i ← j - 1
    while i > 0 and A[i] > key
        A[i + 1] ← A[i]
        i ← i - 1
    A[i + 1] ← key
@note 每次取出key,向左比较，比他大的向右移，遇到小的，直接插入
@note 循环不变式：前 j-1 个元素已经排好
```

### ③ 复杂度分析

毋庸置疑，Best Case 的时间复杂度是 $\Theta(n)$

#### Ⅰ. Worst Case

输入完全逆序，每次都要移动元素，第 $j$ 次移动花费 $\Theta(j) = j-1$，因此：
$$T(n)=\sum_{\mathclap{j}} \Theta(j) = \Theta(n^2)$$

#### Ⅱ. Average Case

平均花费 $\Theta(j/2)$，因此：
$$T(n)=\sum_{\mathclap{j}} \Theta(j/2) = \Theta(n^2)$$

> 小规模 $n$ 时插入排序还不错，但 $n$ 很大时就不快了

## 3. Merge Sort（归并排序）

### ① 基本思想

Divide and Conquer（分治思想），将大的序列拆分为小的序列分别排序，然后递归组合小的序列

### ② 伪代码

```pseudocode MERGE-SORT(A, p, r)
if p < r
    q = ⌊(p + r) / 2⌋         // 取中间位置
    MERGE-SORT(A, p, q)      // 递归排序左半部分
    MERGE-SORT(A, q + 1, r)  // 递归排序右半部分
    MERGE(A, p, q, r)        // 合并两个有序子数组
@note 主程序
```

```pseudocode MERGE(A, p, q, r)
n1 = q - p + 1              // 左子数组长度
n2 = r - q                  // 右子数组长度
// 创建数组 L[1..n1 + 1] 和 R[1..n2 + 1]
for i = 1 to n1
    L[i] = A[p + i - 1]     // 复制左半部分
for j = 1 to n2
    R[j] = A[q + j]         // 复制右半部分
L[n1 + 1] = ∞               // 哨兵值
R[n2 + 1] = ∞               // 哨兵值
i = 1
j = 1
for k = p to r
    if L[i] ≤ R[j]
        A[k] = L[i]
        i = i + 1
    else
        A[k] = R[j]
        j = j + 1
@note 合并程序
```

### ③ 复杂度分析

我们首先设 $T(n)$ 是归并排序处理 $n$ 个元素需要的的时间，每次 divide 会将其分为两个 $T(n/2)$，同时花费 $\Theta(n) = cn$ 的时间合并，因此得到递推式：
$$T(n) = T(n/2) + cn ~~~(c>0)$$

将对应的递归树展开成以下表格：
$$
\begin{array}{|c|c|c|c|}
\hline
层次k & 子问题个数 & 每个子问题规模 & 每层总代价 \\
\hline
0 & 1 = 2^0 & n & cn \\
\hline
1 & 2 = 2^1 & n/2 & cn \\
\hline
2 & 4 = 2^2 & n/4 & cn \\
\hline
3 & 8 = 2^3 & n/8 & cn \\
\hline
\vdots & \vdots & \vdots & \vdots \\
\hline
k & 2^k & n/2^k & cn \\
\hline
\vdots & \vdots & \vdots & \vdots \\
\hline
\log_2 n & n & 1 & cn \\
\hline
\end{array}
$$

不难得到，总的时间复杂度为：
$$T(n) = \sum_{k=0}^{\log_2 n} cn = cn \cdot (\log_2 n + 1) = cn\cdot\log_2 n + cn = \Theta(n \log n)$$