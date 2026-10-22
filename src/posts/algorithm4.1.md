---
title: Topic 4.1
date: 2026-10-13
tags: [算法基础]
summary: 线性时间排序
---

# 一、比较排序的下界

## 1. 比较排序

比较排序是指排序结果仅基于输入元素之间的比较来确定

常见的比较排序算法（如归并排序、堆排序、快速排序）在最坏情况下时间复杂度为 $Ω(n\lg n)$

不失一般性，假设所有输入元素互不相同，因此每次比较只有两种结果：$a_i>a_j$ 或 $a_i<a_j$

## 2. 决策树模型

<p align="center">
  <img src="/devices/4.1.png" alt="决策树">
  <br>
  <small>figure 1：决策树</small>
</p>


决策树是一棵满二叉树，表示比较排序算法对给定输入所执行的比较过程

```fold 满二叉树
> 一棵二叉树，如果每一层的结点数都达到最大值，则称为满二叉树

特点：

- 所有叶子结点都在同一层（最后一层）

- 不存在度为 1 的结点（每个非叶子结点都有 2 个孩子）

- 深度为 $k$ 的满二叉树，结点总数为 $2^k-1$

```

每个内部结点代表一次比较，每个叶子结点代表一种可能的排序结果（即输入的一个排列）

从根到叶子的最长简单路径长度 = 该算法在最坏情况下的比较次数

因此，所有决策树高度的下界就是任何比较排序算法运行时间的下界

## 3. 比较排序下界定理

**定理**：任何比较排序算法在最坏情况下都需要 $Ω(n\lg n)$ 次比较

**证明思路：**
- 长为 $n$ 的序列共有 $n!$ 种排序方式，因此决策树至少有 $n!$ 个可达叶子
- 高为 h 的二叉树最多有 $2^h$ 个叶子结点
- 因此，$n! \leq 2^h$，即 $h \geq \log_2(n!) = \Omega(n\lg n)$

# 二、三种线性时间排序算法

## 1. 计数排序

### ① 基本思想

对每个输入元素 $x$，统计小于等于 $x$ 的元素个数，从而确定 $x$ 在输出数组中的位置

### ② 伪代码

```pseudocode COUNTING-SORT(A, B, k)
for i = 0 to k do
    C[i] = 0
for j = 1 to A.length do
    C[A[j]] = C[A[j]] + 1
// C[i] 现在包含等于 i 的元素个数
for i = 1 to k do
    C[i] = C[i] + C[i-1]
// C[i] 现在包含小于等于 i 的元素个数
for j = A.length downto 1 do
    B[C[A[j]]] = A[j]
    C[A[j]] = C[A[j]] - 1
@note A为待排数组，B为结果数组，C为计数数组，k为数组长度
```
视频演示：
[计数排序](https://www.bilibili.com/video/BV1sU4y1R7pm/?share_source=copy_web&vd_source=8ee3a03707986f87d27c6c1da8aef561)

**复杂度与性质：**

- Overall：$\Theta(n+k)$
- Auxiliary Space：$\Theta(n+k)$
- Stable：Yes

## 2. 基数排序

### ① 基本思想

按最低有效位先排序，再按次低位排序，直到最高位。每一轮排序必须使用稳定的排序算法（通常用计数排序）

### ② 伪代码

```pseudocode RADIX-SORT(A, d)
for i = 1 to d do
    使用稳定排序对数组 A 按第 i 位数字排序
```

**复杂度与性质：**

- 基本复杂度：$\Theta(d(n+k))$ （d 位，每位计数排序）
- b 位二进制数复杂度：$\Theta(\frac{b}{r}(n+2^r))$
- Auxiliary Space：$\Theta(n+k)$ or $\Theta(n+2^r)$
- Stable：Yes

```fold 情况为 b 位二进制数时的复杂度证明以及 r 的选取
不要一位一位地排，而是把 r 个二进制位合并成一组，作为一个大数字来排序
- 基数排序的趟数减少为 $d=⌈b/r⌉$ 趟
- 但每趟的取值范围变为 $2^r$，因为每组有 r 位，所以可以表示 $2^r$ 个数，使用计数排序的话，$k = 2^r$

如何选择 r：
- 若 $b < \log n$，取 $r = b$，运行时间 $\Theta(n)$。
- 若 $b \ge \log n$，取 $r = \log n$，运行时间 $\Theta(bn / \log n)$。
- 增大或减小 $r$ 都会使运行时间变差。
```

## 3. 桶排序

### ① 基本思想

基本假设：输入均匀分布在区间 [0, 1) 上

将 [0,1) 分成 n 个等大的子区间（桶），将 n 个输入元素分配到对应的桶中，对每个桶内的元素用插入排序排序，按桶的顺序依次连接所有元素

### ② 伪代码

```pseudocode BUCKET-SORT(A)
n = A.length
创建数组 B[0..n-1]，每个 B[i] 为空链表
for i = 1 to n do
    将 A[i] 插入到 B[⌊n * A[i]⌋] 中
for i = 0 to n-1 do
    用插入排序对 B[i] 排序
按顺序连接 B[0], B[1], ..., B[n-1]
```

视频演示：
[桶排序](https://www.bilibili.com/video/BV1QT411u7MA/?share_source=copy_web&vd_source=8ee3a03707986f87d27c6c1da8aef561)

**复杂度与性质：**

- Best/Average：$\Theta(n)$
- Worst：$\Theta(n^2)$
- Auxiliary Space：$\Theta(n)$
- Stable：取决于桶内的排序方式

```fold 桶排序复杂度分析
设 $n_i$ 为第 $i$ 个桶中的元素个数，则：

$$
T(n) = \Theta(n) + \sum_{i=0}^{n-1} O(n_i^2)
$$

**解释：**

- $\Theta(n)$：分配元素到桶中（第 3-4 行）和连接桶（第 7 行）的线性时间
- $\sum O(n_i^2)$：每个桶用插入排序，桶 $i$ 耗时 $O(n_i^2)$
```
```fold 期望运行时间
对两边取期望：

$$
E[T(n)] = \Theta(n) + \sum_{i=0}^{n-1} O(E[n_i^2])
$$

**计算 $E[n_i^2]$：**

定义指示随机变量：

$$
X_{ij} = I\{A[j] \text{ 落入桶 } i\}
$$

则 $n_i = \sum_{j=1}^{n} X_{ij}$。

- 每个元素落入桶 $i$ 的概率为 $1/n$，所以 $E[X_{ij}] = 1/n$，$E[X_{ij}^2] = 1/n$。
- 当 $j \neq k$ 时，$X_{ij}$ 与 $X_{ik}$ 独立，$E[X_{ij}X_{ik}] = 1/n^2$。

计算：

$$
E[n_i^2] = \sum_{j=1}^{n} E[X_{ij}^2] + \sum_{j \neq k} E[X_{ij}X_{ik}] = n \cdot \frac{1}{n} + n(n-1) \cdot \frac{1}{n^2} = 1 + \frac{n-1}{n} = 2 - \frac{1}{n}
$$

最终结果：
$$
E[T(n)] = \Theta(n) + n \cdot O\left(2 - \frac{1}{n}\right) = \Theta(n)
$$
```
